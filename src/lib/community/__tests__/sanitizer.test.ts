import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSanitizedMarkdown } from '../sanitizer.ts';

test('sanitizer: <script> is stripped', () => {
  const out = renderSanitizedMarkdown('<script>alert(1)</script>hello');
  assert.ok(!out.includes('<script'), 'must not contain <script');
  assert.ok(!out.toLowerCase().includes('alert(1)'), 'must not contain alert payload as code');
});

test('sanitizer: javascript: href is dropped', () => {
  const out = renderSanitizedMarkdown('[click](javascript:alert(1))');
  assert.ok(!out.toLowerCase().includes('javascript:'), `output contained javascript: -> ${out}`);
});

test('sanitizer: <iframe> is stripped', () => {
  const out = renderSanitizedMarkdown('<iframe src="https://evil.example"></iframe>');
  assert.ok(!out.includes('<iframe'), 'must not contain <iframe');
});

test('sanitizer: event handlers (onclick, onerror) on <a> are stripped, href stays', () => {
  const out = renderSanitizedMarkdown('<a href="https://ok.example" onclick="x()">x</a>');
  assert.ok(!out.includes('onclick'), 'onclick must be stripped');
  assert.ok(out.includes('https://ok.example'), 'safe href should survive');
});

test('sanitizer: <img> is stripped (no inline images allowed in v1)', () => {
  const out = renderSanitizedMarkdown('<img src="x" onerror="alert(1)">');
  assert.ok(!out.includes('<img'), 'must not contain <img');
  assert.ok(!out.includes('onerror'), 'must not contain onerror');
});

test('sanitizer: positive — bold/italic/code render through', () => {
  const out = renderSanitizedMarkdown('**bold** *em* `code`');
  assert.ok(out.includes('<strong>bold</strong>') || out.includes('<strong>'), `expected <strong>: ${out}`);
  assert.ok(out.includes('<em>em</em>') || out.includes('<em>'), `expected <em>: ${out}`);
  assert.ok(out.includes('<code>code</code>') || out.includes('<code>'), `expected <code>: ${out}`);
});

test('sanitizer: @mention rewritten to /community/members/<handle>', () => {
  const out = renderSanitizedMarkdown('hi @alice');
  assert.ok(out.includes('/community/members/alice'), `expected mention link: ${out}`);
});

test('sanitizer: #hashtag rewritten to /community/tag/<tag>', () => {
  const out = renderSanitizedMarkdown('news #welcome');
  assert.ok(out.includes('/community/tag/welcome'), `expected hashtag link: ${out}`);
});
