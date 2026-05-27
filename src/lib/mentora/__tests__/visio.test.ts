import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVisioRoomUrl } from '../visio.ts';

test('buildVisioRoomUrl returns a Jitsi URL with the brand prefix and the session fragment', () => {
  const url = buildVisioRoomUrl('clz9y7xj30000abcd1234efgh');
  assert.equal(url, 'https://meet.jit.si/mentorat-digizelle-clz9y7xj30000abcd1234efgh');
});

test('buildVisioRoomUrl normalises mixed-case session ids', () => {
  const a = buildVisioRoomUrl('ABCDEF');
  const b = buildVisioRoomUrl('abcdef');
  assert.equal(a, b);
});

test('buildVisioRoomUrl strips non-alphanumeric characters from the fragment', () => {
  const url = buildVisioRoomUrl('session/with:weird.chars');
  // Fragment is lowercased + stripped → keeps "sessionwithweirdchars"
  assert.equal(url, 'https://meet.jit.si/mentorat-digizelle-sessionwithweirdchars');
});

test('buildVisioRoomUrl returns null for null / undefined / empty input', () => {
  assert.equal(buildVisioRoomUrl(null), null);
  assert.equal(buildVisioRoomUrl(undefined), null);
  assert.equal(buildVisioRoomUrl(''), null);
});

test('buildVisioRoomUrl is deterministic — same id always yields same URL', () => {
  const id = 'clz-abc-123';
  assert.equal(buildVisioRoomUrl(id), buildVisioRoomUrl(id));
});
