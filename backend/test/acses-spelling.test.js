const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixAscesSpelling } = require('../acses-spelling');

test('fixAscesSpelling corrects ASCES to ACSES', () => {
  assert.equal(fixAscesSpelling("ASCES AWARDS '26"), "ACSES AWARDS '26");
  assert.equal(fixAscesSpelling('ASCES Awards Night'), 'ACSES Awards Night');
});

test('fixAscesSpelling leaves correct ACSES unchanged', () => {
  assert.equal(fixAscesSpelling("ACSES AWARDS '26"), "ACSES AWARDS '26");
});

test('fixAscesSpelling handles empty values', () => {
  assert.equal(fixAscesSpelling(''), '');
  assert.equal(fixAscesSpelling(null), null);
});
