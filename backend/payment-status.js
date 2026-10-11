const { generateStatusToken } = require('./security');

function buildRushPayCheckoutResponse(paymentReference, widgetSessionToken, extra = {}) {
  return {
    ...extra,
    paymentReference,
    widgetSessionToken,
    statusToken: generateStatusToken(paymentReference),
    isMock: false,
  };
}

module.exports = {
  buildRushPayCheckoutResponse,
};
