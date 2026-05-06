/**
 * PostBody — renders sanitized HTML (or fallback plain markdown) for a Post
 * or Comment body.
 *
 * SANITIZER TRUST PATH (read carefully):
 *   1. Server-side, the trusted sanitizer is `renderSanitizedMarkdown` from
 *      `@/lib/community/sanitizer` (owned by Agent 3B-2). That function pipes
 *      `marked` → `isomorphic-dompurify` with a strict allowlist (see spec
 *      §3.4). Its output is HTML safe to inject as-is.
 *   2. This component **only** uses `dangerouslySetInnerHTML` when the caller
 *      passes `safeHtml` — a string that has already been through the
 *      trusted server-side sanitizer. The prop is named `safeHtml` (not
 *      `html`) precisely so a reviewer can grep for it and confirm the
 *      origin of the value.
 *   3. If `safeHtml` is missing, the fallback path renders the raw body as a
 *      `<pre style="white-space:pre-wrap">` text node. This is safe because
 *      React text rendering escapes by default.
 *   4. NEVER accept `safeHtml` from a client component or from a request
 *      body without re-sanitizing on the server first.
 *
 * Mentions and hashtags are turned into anchor tags by the sanitizer's
 * post-processing pass (also server-side); no extra work here.
 */

type Props = {
  /** HTML output of `renderSanitizedMarkdown` from `@/lib/community/sanitizer`. */
  safeHtml?: string;
  /** Raw markdown — used only as fallback when sanitizer is unavailable. */
  fallbackText?: string;
  /** Optional CSS overrides; defaults to a readable prose layout. */
  style?: React.CSSProperties;
};

export default function PostBody({ safeHtml, fallbackText, style }: Props) {
  const baseStyle: React.CSSProperties = {
    fontSize: 16,
    lineHeight: 1.65,
    wordBreak: 'break-word',
    ...style,
  };

  if (safeHtml) {
    // SAFETY: see file header. `safeHtml` MUST come from the server-side
    // sanitizer in `@/lib/community/sanitizer`. Do not pass user-controlled
    // HTML directly here.
    return (
      <div
        className="dz-prose"
        style={baseStyle}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return (
    <div className="dz-prose" style={baseStyle}>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
        {fallbackText ?? ''}
      </pre>
    </div>
  );
}
