import { BRANDING } from '../branding';

function roundGhs(amount) {
  return Math.round(amount * 100) / 100;
}

/** Mirror backend gross-up — keep fee percent in sync with branding.js */
export function calculatePaystackCheckout(baseGhs) {
  const feePercent = BRANDING.paystackFeePercent ?? 1.95;
  const passFee = BRANDING.passPaystackFeeToCustomer !== false;
  const baseAmount = roundGhs(Number(baseGhs) || 0);

  if (!passFee || feePercent <= 0 || baseAmount <= 0) {
    const amountMinor = Math.max(100, Math.round(baseAmount * 100));
    return {
      baseAmount,
      processingFee: 0,
      totalDue: amountMinor / 100,
      amountMinor,
      feePercent: 0,
    };
  }

  const rate = feePercent / 100;
  const amountMinor = Math.max(100, Math.ceil((baseAmount / (1 - rate)) * 100));
  const totalDue = amountMinor / 100;

  return {
    baseAmount,
    processingFee: roundGhs(totalDue - baseAmount),
    totalDue,
    amountMinor,
    feePercent,
  };
}
