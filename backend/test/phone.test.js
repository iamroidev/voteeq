const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeGhanaPhone,
  getMomoProvider,
} = require('../phone');

test('normalizes Arkesel MSISDNs to local Ghana phone format', () => {
  assert.equal(normalizeGhanaPhone('233543210987'), '0543210987');
  assert.equal(normalizeGhanaPhone('+233 26-123-4567'), '0261234567');
});

test('maps Ghana mobile money prefixes to Paystack provider codes', () => {
  assert.equal(getMomoProvider('0241234567'), 'mtn');
  assert.equal(getMomoProvider('233501234567'), 'vod');
  assert.equal(getMomoProvider('233261234567'), 'atl');
  assert.equal(getMomoProvider('0571234567'), 'atl');
});
