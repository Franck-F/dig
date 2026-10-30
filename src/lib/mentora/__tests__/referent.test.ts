import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMentoraReferent } from '../referent.ts';

test('empty env falls back to the generic Digizelle contact', () => {
  assert.deepEqual(getMentoraReferent({}), {
    name: 'Équipe Digizelle',
    role: 'Référente Mentorat',
    email: 'contact@digizelle.fr',
    photoUrl: null,
  });
});

test('env values override the defaults', () => {
  assert.deepEqual(
    getMentoraReferent({
      MENTORA_REFERENT_NAME: 'Awa',
      MENTORA_REFERENT_ROLE: 'Référente Île-de-France',
      MENTORA_REFERENT_EMAIL: 'awa@digizelle.fr',
      MENTORA_REFERENT_PHOTO_URL: 'https://cdn.example.com/awa.jpg',
    }),
    {
      name: 'Awa',
      role: 'Référente Île-de-France',
      email: 'awa@digizelle.fr',
      photoUrl: 'https://cdn.example.com/awa.jpg',
    },
  );
});

test('an invalid email falls back to the default address', () => {
  assert.equal(getMentoraReferent({ MENTORA_REFERENT_EMAIL: 'not-an-email' }).email, 'contact@digizelle.fr');
});

test('a non-https photo URL is dropped', () => {
  assert.equal(getMentoraReferent({ MENTORA_REFERENT_PHOTO_URL: 'http://cdn.example.com/a.jpg' }).photoUrl, null);
  assert.equal(getMentoraReferent({ MENTORA_REFERENT_PHOTO_URL: 'javascript:alert(1)' }).photoUrl, null);
});

test('blank strings count as unset', () => {
  const r = getMentoraReferent({ MENTORA_REFERENT_NAME: '   ', MENTORA_REFERENT_ROLE: '' });
  assert.equal(r.name, 'Équipe Digizelle');
  assert.equal(r.role, 'Référente Mentorat');
});
