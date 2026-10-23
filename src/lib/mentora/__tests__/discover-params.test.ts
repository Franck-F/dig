import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscoverHref, parseDiscoverParams } from '../discover-params.ts';

test('empty params fall back to defaults', () => {
  assert.deepEqual(parseDiscoverParams({}), { reactiveOnly: false, sort: 'relevance', page: 1 });
});

test('unknown sort falls back to relevance', () => {
  assert.equal(parseDiscoverParams({ sort: 'foo' }).sort, 'relevance');
  assert.equal(parseDiscoverParams({ sort: 'recent' }).sort, 'recent');
});

test('category must be a known skill category', () => {
  assert.equal(parseDiscoverParams({ category: 'xyz' }).category, undefined);
  assert.equal(parseDiscoverParams({ category: 'CAREER' }).category, 'CAREER');
});

test('page is a positive integer', () => {
  assert.equal(parseDiscoverParams({ page: '-3' }).page, 1);
  assert.equal(parseDiscoverParams({ page: 'abc' }).page, 1);
  assert.equal(parseDiscoverParams({ page: '4' }).page, 4);
});

test('reactive flag only accepts 1', () => {
  assert.equal(parseDiscoverParams({ reactive: '1' }).reactiveOnly, true);
  assert.equal(parseDiscoverParams({ reactive: 'maybe' }).reactiveOnly, false);
});

test('query is trimmed and capped at 200 characters', () => {
  assert.equal(parseDiscoverParams({ q: 'x'.repeat(300) }).q?.length, 200);
  assert.equal(parseDiscoverParams({ q: '   ' }).q, undefined);
});

test('format and rating outside the allowed range are dropped', () => {
  assert.equal(parseDiscoverParams({ format: 'TELEPATHY' }).format, undefined);
  assert.equal(parseDiscoverParams({ format: 'REMOTE' }).format, 'REMOTE');
  assert.equal(parseDiscoverParams({ minRating: '9' }).minRating, undefined);
  assert.equal(parseDiscoverParams({ minRating: '4' }).minRating, 4);
});

test('legacy skills and language params are still read', () => {
  const p = parseDiscoverParams({ skills: 'react, ux ,', language: ' fr ' });
  assert.deepEqual(p.skillSlugs, ['react', 'ux']);
  assert.deepEqual(p.languages, ['fr']);
});

test('href with defaults is the bare directory URL', () => {
  assert.equal(buildDiscoverHref(parseDiscoverParams({})), '/mentora/discover');
});

test('href override keeps the active filters', () => {
  const href = buildDiscoverHref(parseDiscoverParams({ category: 'CAREER', reactive: '1' }), { page: 2 });
  const url = new URL(href, 'https://x.test');
  assert.equal(url.pathname, '/mentora/discover');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('category'), 'CAREER');
  assert.equal(url.searchParams.get('reactive'), '1');
});
