/**
 * Paystack Ghana local fee is deducted from the transaction before settlement.
 * Gross up the charge so the organizer nets the intended base amount.
 *
 * Example: GH₵ 1.00 vote base @ 1.95% → voter pays GH₵ 1.02 (ceil to pesewa).
 */

function getPaystackFeePercent() {
  const parsed = parseFloat(process.env.PAYSTACK_FEE_PERCENT || '1.95');
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 100) return 1.95;
  return parsed;
}

function passPaystackFeeToCustomer() {
  return process.env.PASS_PAYSTACK_FEE_TO_CUSTOMER !== 'false';
}

function roundGhs(amount) {
  return Math.round(amount * 100) / 100;
}

function calculatePaystackCheckout(baseGhs, options = {}) {
  const feePercent = options.feePercent ?? getPaystackFeePercent();
  const passFee = options.passFee ?? passPaystackFeeToCustomer();
  const baseAmount = roundGhs(Number(baseGhs) || 0);

  if (!passFee || feePercent <= 0 || baseAmount <= 0) {
    const amountMinor = Math.max(100, Math.round(baseAmount * 100));
    const totalDue = amountMinor / 100;
    return {
      baseAmount,
      processingFee: 0,
      totalDue,
      amountMinor,
      feePercent: passFee ? feePercent : 0,
    };
  }

  const rate = feePercent / 100;
  // Ceil so settlement after Paystack's cut is at least the base amount.
  const amountMinor = Math.max(100, Math.ceil((baseAmount / (1 - rate)) * 100));
  const totalDue = amountMinor / 100;
  const processingFee = roundGhs(totalDue - baseAmount);

  return {
    baseAmount,
    processingFee,
    totalDue,
    amountMinor,
    feePercent,
  };
}

module.exports = {
  getPaystackFeePercent,
  passPaystackFeeToCustomer,
  calculatePaystackCheckout,
};
