const { ACSES_AWARD_CATEGORIES } = require('./seed-acses-categories');

class RegistrationApprovalError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'RegistrationApprovalError';
    this.status = status;
  }
}

function isRegistrationApprovalError(err) {
  return err instanceof RegistrationApprovalError;
}

function generateActivationPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function assignNomineeRegistration(db, id, { awardCategories = ACSES_AWARD_CATEGORIES, activationPin = generateActivationPin } = {}) {
  return db.transaction(async (tx) => {
    const reg = await tx.get('SELECT * FROM nominee_registrations WHERE id = ?', [id]);
    if (!reg) {
      throw new RegistrationApprovalError('Registration not found', 404);
    }

    if (reg.payment_status !== 'completed') {
      throw new RegistrationApprovalError('Form fee payment is not completed yet');
    }

    if (reg.approval_status !== 'pending') {
      throw new RegistrationApprovalError('Registration is already processed');
    }

    let finalCategoryId = reg.category_id;
    if (!finalCategoryId && reg.custom_category) {
      const customCatName = reg.custom_category.trim();
      let existingCat = await tx.get('SELECT id FROM categories WHERE name = ?', [customCatName]);
      if (!existingCat) {
        const createResult = await tx.run(
          'INSERT INTO categories (name, description) VALUES (?, ?)',
          [customCatName, 'Approved Custom Category']
        );
        finalCategoryId = createResult.lastID;
      } else {
        finalCategoryId = existingCat.id;
      }
    }

    if (!finalCategoryId) {
      throw new RegistrationApprovalError('Category selection or request is missing');
    }

    const categoryRecord = await tx.get('SELECT name FROM categories WHERE id = ?', [finalCategoryId]);
    const categoryName = categoryRecord?.name || '';
    const listIndex = awardCategories.findIndex((cat) => (Array.isArray(cat) ? cat[0] : cat) === categoryName);
    const prefix = listIndex !== -1 ? (listIndex + 1) : finalCategoryId;

    let assignedCode = '';
    let nomineeSeq = 1;
    while (true) {
      const seqStr = nomineeSeq.toString().padStart(2, '0');
      const candidateCode = `${prefix}${seqStr}`;
      const duplicate = await tx.get('SELECT id FROM nominees WHERE code = ?', [candidateCode]);
      if (!duplicate) {
        assignedCode = candidateCode;
        break;
      }
      nomineeSeq += 1;
    }

    const tempPin = activationPin();

    await tx.run(`
      INSERT INTO nominees (code, name, photo_url, category_id, passcode, votes_count)
      VALUES (?, ?, ?, ?, ?, 0)
    `, [
      assignedCode,
      reg.name,
      reg.photo_url,
      finalCategoryId,
      `PENDING_ACT_${tempPin}`,
    ]);

    const updated = await tx.run(`
      UPDATE nominee_registrations
      SET approval_status = 'approved', nominee_code = ?, activation_pin = ?
      WHERE id = ? AND approval_status = 'pending'
    `, [assignedCode, tempPin, id]);

    if (!updated.changes) {
      throw new RegistrationApprovalError('Registration is already processed');
    }

    return { reg, finalCategoryId, assignedCode, tempPin };
  });
}

async function rejectNomineeRegistration(db, id) {
  const reg = await db.get('SELECT id, approval_status FROM nominee_registrations WHERE id = ?', [id]);
  if (!reg) {
    throw new RegistrationApprovalError('Registration not found', 404);
  }

  const updated = await db.run(
    "UPDATE nominee_registrations SET approval_status = 'rejected' WHERE id = ? AND approval_status = 'pending'",
    [id]
  );

  if (!updated.changes) {
    throw new RegistrationApprovalError('Registration is already processed');
  }

  return reg;
}

module.exports = {
  RegistrationApprovalError,
  isRegistrationApprovalError,
  assignNomineeRegistration,
  rejectNomineeRegistration,
};
