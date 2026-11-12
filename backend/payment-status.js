const { generateStatusToken } = require('./security');

function buildRushPayCheckoutResponse({ paymentReference, widgetSessionToken, ...rest }) {
  return {
    paymentReference,
    widgetSessionToken,
    ...rest,
    statusToken: generateStatusToken(paymentReference),
    isMock: false,
  };
}

module.exports = {
  buildRushPayCheckoutResponse,
};
