/**
 * Markdown → safe HTML pipeline. Spec §3.4.
 *
 * Pipeline:
 *   1. `marked.parse(raw)` — markdown to HTML (CommonMark + GFM extras).
 *   2. `DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })`.
 *   3. Post-pass that hardens `<a>` (rel + target) and rewrites mention/hashtag
 *      anchors to internal community routes.
 *
 * Allowlist (per spec):
 *   p, br, strong, em, code, pre, blockquote, ul, ol, li, a[href|title]
 *
 * Stripped: script, style, iframe, object, svg, img, h1..h6, plus any
 * event handler attributes (`onclick`, `onerror`, …) and `javascript:` href.
 *
 * No DB, no I/O. Safe to call from RSC or server action.
 */

import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// Regexes are mirrored from `./mentions.ts` and `./hashtags.ts`. They are kept
// inline so this file can be loaded by `node --test --experimental-strip-types`
// (Node's ESM strict resolver does not resolve extension-less .ts siblings).
// If you change the regexes in mentions.ts or hashtags.ts, mirror the change here.
const MENTION_REGEX = /(?<![a-z0-9_])@([a-z0-9_]{3,30})(?![a-z0-9_])/gi;
const HASHTAG_REGEX = /(?<![a-z0-9_])#([a-z0-9_]{1,32})/gi;

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
];

const ALLOWED_ATTR = ['href', 'title'];

/** Configure marked once. Disable raw HTML — we strip what we don't allow. */
marked.setOptions({
  gfm: true,
  breaks: true,
});

function isSafeHref(href: string): boolean {
  if (!href) return false;
  const trimmed = href.trim().toLowerCase();
  if (trimmed.startsWith('https://')) return true;
  if (trimmed.startsWith('http://')) return true;
  if (trimmed.startsWith('mailto:')) return true;
  if (trimmed.startsWith('/community/')) return true;
  return false;
}

// DOMPurify hooks: harden anchors. Registered once per module load.
let hooksRegistered = false;
function ensureHooks() {
  if (hooksRegistered) return;
  hooksRegistered = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      if (!isSafeHref(href)) {
        node.removeAttribute('href');
      }
      // External links: open in new tab + safe rel.
      if (href.startsWith('http://') || href.startsWith('https://')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }
  });
}

/**
 * Replace `@handle` and `#tag` text occurrences with anchor tags pointing to
 * the community routes. Runs on raw markdown before marked parses it so the
 * resulting anchors survive the sanitiser allowlist.
 *
 * Edge case — text inside fenced code blocks ``` ``` ```` is left intact (
 * marked emits it as <code> with escaped contents, so HTML injection is moot).
 */
function rewriteMentionsAndHashtags(raw: string): string {
  // Split on fenced code blocks; only rewrite outside them.
  const parts = raw.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return parts
    .map((part, idx) => {
      // Odd indices are fenced/inline code. Keep verbatim.
      if (idx % 2 === 1) return part;
      let out = part.replace(MENTION_REGEX, (_m, handle: string) => {
        const lower = handle.toLowerCase();
        return `[@${handle}](/community/members/${lower})`;
      });
      out = out.replace(HASHTAG_REGEX, (_m, tag: string) => {
        const lower = tag.toLowerCase();
        return `[#${tag}](/community/tag/${lower})`;
      });
      return out;
    })
    .join('');
}

/**
 * Convert raw markdown to safe HTML. Returns the empty string on failure.
 * NEVER throws; sanitisation errors are logged and the returned string is
 * a plain-text escape of the input (so the post still renders).
 */
export function renderSanitizedMarkdown(raw: string): string {
  if (!raw) return '';
  ensureHooks();
  try {
    const enriched = rewriteMentionsAndHashtags(raw);
    const html = marked.parse(enriched, { async: false }) as string;
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'svg', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      FORBID_ATTR: ['style', 'class', 'id', 'onerror', 'onclick', 'onload'],
    });
    return clean;
  } catch (e) {
    console.error('[community sanitizer] failed', e);
    // Last-resort: HTML-escape the raw text so something renders.
    return escapeHtml(raw);
  }
}

/** Alias for legacy callers. */
export const sanitizeMarkdown = renderSanitizedMarkdown;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
