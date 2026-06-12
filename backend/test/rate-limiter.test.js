const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../rate-limiter');

function mockReq(ip = '10.0.0.1') {
  return {
    ip,
    headers: {},
    socket: { remoteAddress: ip },
  };
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('createRateLimiter', () => {
  it('allows requests under the limit', () => {
    const limiter = createRateLimiter(60_000, 3);
    let hits = 0;
    const next = () => { hits += 1; };

    for (let i = 0; i < 3; i += 1) {
      limiter(mockReq(), mockRes(), next);
    }
    assert.equal(hits, 3);
  });

  it('blocks requests over the limit from the same IP', () => {
    const limiter = createRateLimiter(60_000, 2);
    const next = () => {};
    const req = mockReq('192.168.1.50');

    limiter(req, mockRes(), next);
    limiter(req, mockRes(), next);

    const res = mockRes();
    limiter(req, res, next);
    assert.equal(res.statusCode, 429);
    assert.match(res.body.error, /Too many requests/);
  });

  it('tracks IPs independently (shared campus WiFi scenario)', () => {
    const limiter = createRateLimiter(60_000, 1);
    const next = () => {};

    const resA = mockRes();
    limiter(mockReq('10.0.0.1'), mockRes(), next);
    limiter(mockReq('10.0.0.1'), resA, next);
    assert.equal(resA.statusCode, 429);

    let allowed = false;
    limiter(mockReq('10.0.0.2'), mockRes(), () => { allowed = true; });
    assert.equal(allowed, true);
  });
});
