// Run: `npm test`. Tests are excluded from tsc via tsconfig.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseQuery } from '../search-query.ts';

test('search.normaliseQuery: empty / whitespace returns null', () => {
  assert.equal(normaliseQuery(''), null);
  assert.equal(normaliseQuery('   '), null);
  assert.equal(normaliseQuery('\t\n'), null);
});

test('search.normaliseQuery: single token gets prefix wildcard', () => {
  assert.equal(normaliseQuery('mentor'), 'mentor:*');
});

test('search.normaliseQuery: multiple tokens AND-joined, last is prefix', () => {
  assert.equal(normaliseQuery('inclusion numérique'), 'inclusion & numérique:*');
});

test('search.normaliseQuery: 1-char tokens dropped', () => {
  // The lone `a` and `à` are too short — only `bob` survives.
  assert.equal(normaliseQuery('a bob à'), 'bob:*');
});

test('search.normaliseQuery: tsquery operators stripped (anti-injection)', () => {
  // `&|!:*()` would otherwise parse as tsquery operators.
  const r = normaliseQuery('mentor & moi | !ban');
  // After the alphanum-only filter only the words remain.
  assert.equal(r, 'mentor & moi & ban:*');
});

test('search.normaliseQuery: caps at 6 tokens', () => {
  const r = normaliseQuery('one two three four five six seven eight');
  // 6 tokens kept, last gets :*
  const tokens = (r ?? '').split(' & ');
  assert.equal(tokens.length, 6);
  assert.ok(tokens[5].endsWith(':*'));
  assert.ok(!tokens[0].includes(':*'));
});

test('search.normaliseQuery: tokens longer than 40 chars dropped', () => {
  const longTok = 'a'.repeat(60);
  assert.equal(normaliseQuery(`${longTok} mentor`), 'mentor:*');
});

test('search.normaliseQuery: French accents preserved (NFC normalised)', () => {
  // The dictionary 'french' handles accent stripping at the tsquery
  // layer, but our normaliser must keep the byte order intact.
  const r = normaliseQuery('française rébellion');
  assert.equal(r, 'française & rébellion:*');
});

test('search.normaliseQuery: only-punctuation returns null', () => {
  assert.equal(normaliseQuery('!&|*()/'), null);
});

test('search.normaliseQuery: mixed-case preserved (Postgres lowercases)', () => {
  // We keep the case as-typed. tsquery is case-insensitive in Postgres.
  assert.equal(normaliseQuery('Mentor'), 'Mentor:*');
});
