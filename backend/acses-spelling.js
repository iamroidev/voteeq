/** Correct legacy misspelling ASCES → ACSES (Association of Computer Science and Engineering Students). */
function fixAscesSpelling(text) {
  if (text == null || text === '') return text;
  return String(text).replace(/ASCES/g, 'ACSES');
}

module.exports = { fixAscesSpelling };
