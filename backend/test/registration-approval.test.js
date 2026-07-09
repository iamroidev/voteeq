const { describe, it, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  assignNomineeRegistration,
  rejectNomineeRegistration,
  RegistrationApprovalError,
} = require('../registration-approval');
const { createTestDb, destroyTestDb } = require('./test-db');

async function seedCompletedRegistration(db) {
  await db.run('INSERT INTO categories (name, description) VALUES (?, ?)', ['Test Category', '']);
  await db.run(`
    INSERT INTO nominee_registrations (
      name, email, phone, photo_url, category_id, payment_reference, payment_status, approval_status
    )
    VALUES (?, ?, ?, ?, ?, ?, 'completed', 'pending')
  `, [
    'Applicant',
    'applicant@test.com',
    '0244000000',
    'https://example.com/photo.jpg',
    1,
    'reg_paid_001',
  ]);
}

describe('registration approval workflow', () => {
  let ctx;

  beforeEach(async () => {
    if (ctx) await destroyTestDb(ctx);
    ctx = await createTestDb();
    await seedCompletedRegistration(ctx.db);
  });

  after(async () => {
    if (ctx) await destroyTestDb(ctx);
  });

  it('approves a paid registration exactly once', async () => {
    const result = await assignNomineeRegistration(ctx.db, 1, {
      awardCategories: ['Test Category'],
      activationPin: () => '123456',
    });

    assert.equal(result.assignedCode, '101');
    assert.equal(result.tempPin, '123456');

    const reg = await ctx.db.get('SELECT approval_status, nominee_code, activation_pin FROM nominee_registrations WHERE id = 1');
    assert.deepEqual(reg, {
      approval_status: 'approved',
      nominee_code: '101',
      activation_pin: '123456',
    });

    const nominees = await ctx.db.all('SELECT code, name, passcode FROM nominees ORDER BY id');
    assert.deepEqual(nominees, [{
      code: '101',
      name: 'Applicant',
      passcode: 'PENDING_ACT_123456',
    }]);

    await assert.rejects(
      () => assignNomineeRegistration(ctx.db, 1, {
        awardCategories: ['Test Category'],
        activationPin: () => '999999',
      }),
      (err) => err instanceof RegistrationApprovalError && err.message === 'Registration is already processed'
    );

    const nomineeCount = await ctx.db.get('SELECT COUNT(*) as count FROM nominees');
    assert.equal(nomineeCount.count, 1);
  });

  it('does not overwrite a processed registration when rejecting twice', async () => {
    await rejectNomineeRegistration(ctx.db, 1);

    const reg = await ctx.db.get('SELECT approval_status FROM nominee_registrations WHERE id = 1');
    assert.equal(reg.approval_status, 'rejected');

    await assert.rejects(
      () => rejectNomineeRegistration(ctx.db, 1),
      (err) => err instanceof RegistrationApprovalError && err.message === 'Registration is already processed'
    );

    const afterRetry = await ctx.db.get('SELECT approval_status FROM nominee_registrations WHERE id = 1');
    assert.equal(afterRetry.approval_status, 'rejected');
  });
});
