import { test } from 'node:test';
import assert from 'node:assert/strict';

import { csvCell, toCsv } from '../report-csv.ts';

test('csvCell: préfixe les caractères de formule par une apostrophe', () => {
  assert.equal(csvCell('=1+1'), "'=1+1");
  assert.equal(csvCell('+33'), "'+33");
  assert.equal(csvCell('-2'), "'-2");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell('\tx'), "'\tx");
});

test('csvCell: formule + guillemets + virgule échappés ensemble', () => {
  assert.equal(csvCell('=A,"B"'), `"'=A,""B"""`);
});

test('csvCell: texte sûr inchangé', () => {
  assert.equal(csvCell('Marie Curie'), 'Marie Curie');
  assert.equal(csvCell(42), '42');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(undefined), '');
});

test('csvCell: wrap RFC 4180 conservé', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell('a\nb'), '"a\nb"');
});

test('toCsv: BOM + en-têtes + lignes en CRLF', () => {
  const out = toCsv(['x', 'y'], [['=1', 'ok']]);
  assert.equal(out, "﻿x,y\r\n'=1,ok\r\n");
});
