// requires Node 22+ (or run with `tsx --test`).
// Run: `npm test`. Tests are excluded from tsc via tsconfig.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMentions } from '../mentions.ts';

test('mentions: single handle', () => {
  const r = extractMentions('hello @alice');
  assert.deepEqual(r.handles, ['alice']);
  assert.equal(r.indices.length, 1);
  assert.equal(r.indices[0].handle, 'alice');
});

test('mentions: not a mention inside an email-like token', () => {
  const r = extractMentions('email user@example.com is not a mention');
  assert.deepEqual(r.handles, []);
});

test('mentions: dedup multiple, first-occurrence order, lowercased', () => {
  const r = extractMentions('@Alice @bob @ALICE');
  assert.deepEqual(r.handles, ['alice', 'bob']);
});

test('mentions: 2-char handle is too short → ignored', () => {
  const r = extractMentions('hi @ab');
  assert.deepEqual(r.handles, []);
});

test('mentions: code-block content still extracts (parser is body-pre-sanitization)', () => {
  // Spec §9.2 case 5: extractor sees raw body. Sanitiser handles render.
  const r = extractMentions('`code @nope`');
  assert.deepEqual(r.handles, ['nope']);
});

test('mentions: 30 in a row → only first 25 returned', () => {
  const handles = Array.from({ length: 30 }, (_, i) => `user${String(i).padStart(3, '0')}`);
  const body = handles.map((h) => `@${h}`).join(' ');
  const r = extractMentions(body);
  assert.equal(r.handles.length, 25);
  assert.deepEqual(r.handles[0], 'user000');
  assert.deepEqual(r.handles[24], 'user024');
});

test('mentions: empty body returns empty arrays', () => {
  const r = extractMentions('');
  assert.deepEqual(r.handles, []);
  assert.deepEqual(r.indices, []);
});

test('mentions: indices contain start/end byte offsets', () => {
  const body = 'hi @alice and @bob';
  const r = extractMentions(body);
  assert.equal(r.indices.length, 2);
  assert.equal(body.slice(r.indices[0].start, r.indices[0].end), '@alice');
  assert.equal(body.slice(r.indices[1].start, r.indices[1].end), '@bob');
});
