/**
 * Shared markdown editing primitives used by `PostComposer` and
 * `CommentComposer`. Two surfaces:
 *
 *   1. `applyMarkdownAction()` — programmatic invocation for toolbar
 *      buttons. Wraps the current selection or inserts at the caret.
 *   2. `handleMarkdownKeyDown()` — keyboard interceptor that maps
 *      Ctrl/Cmd-B/I/K/L/`/. to their corresponding markdown action
 *      and prevents the browser default.
 *
 * Both operate on a `<textarea>` accessed via ref. Pure DOM ops + a
 * `setValue` callback keep us framework-agnostic so the same helper
 * can serve future surfaces (mentora bio editor, mentee goals, …).
 *
 * Why intercept on `keydown` rather than `keypress`? `keydown` fires
 * before the browser's default for shortcuts (Ctrl-B = bold in some
 * rich-text browsers, Ctrl-K = clear address bar, Ctrl-L = focus URL
 * bar). `preventDefault()` here stops the surprise.
 *
 * Cross-platform: we treat `metaKey` (Cmd on macOS) and `ctrlKey`
 * (Ctrl on Linux/Windows) as equivalent. Browsers don't normalise
 * this for us.
 */

export type MarkdownAction =
  | 'bold'
  | 'italic'
  | 'code'
  | 'list'
  | 'orderedList'
  | 'quote'
  | 'heading';

const ACTION_TO_OP: Record<
  MarkdownAction,
  | { kind: 'wrap'; before: string; after: string; placeholder: string }
  | { kind: 'insert'; snippet: string }
> = {
  bold: { kind: 'wrap', before: '**', after: '**', placeholder: 'gras' },
  italic: { kind: 'wrap', before: '*', after: '*', placeholder: 'italique' },
  code: { kind: 'wrap', before: '`', after: '`', placeholder: 'code' },
  list: { kind: 'insert', snippet: '\n- ' },
  orderedList: { kind: 'insert', snippet: '\n1. ' },
  quote: { kind: 'insert', snippet: '\n> ' },
  heading: { kind: 'insert', snippet: '\n## ' },
};

export function applyMarkdownAction(args: {
  action: MarkdownAction;
  textarea: HTMLTextAreaElement | null;
  value: string;
  setValue: (next: string) => void;
}): void {
  const { action, textarea, value, setValue } = args;
  if (!textarea) return;
  const op = ACTION_TO_OP[action];
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  if (op.kind === 'wrap') {
    const selected = value.slice(start, end) || op.placeholder;
    const next = value.slice(0, start) + op.before + selected + op.after + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + op.before.length,
        start + op.before.length + selected.length,
      );
    });
    return;
  }

  // insert at cursor
  const next = value.slice(0, start) + op.snippet + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    textarea.focus();
    const caret = start + op.snippet.length;
    textarea.setSelectionRange(caret, caret);
  });
}

/**
 * `keydown` handler. Returns `true` when the event was handled (and
 * the caller can skip its own logic), `false` otherwise. The handler
 * calls `preventDefault()` itself when it consumes the key — callers
 * never need to.
 *
 * Map (Ctrl on Win/Linux, Cmd on macOS):
 *   Ctrl-B           → bold
 *   Ctrl-I           → italic
 *   Ctrl-`           → inline code
 *   Ctrl-Shift-8     → unordered list  (mirrors Notion / Slack)
 *   Ctrl-Shift-7     → ordered list
 *   Ctrl-Shift-.     → blockquote      (Gmail-style)
 *
 * `Ctrl-K` is deliberately NOT mapped — link insertion needs a URL
 * prompt that the host component owns. Components can layer their
 * own `Ctrl-K` handler on top.
 */
export function handleMarkdownKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  args: {
    textarea: HTMLTextAreaElement | null;
    value: string;
    setValue: (next: string) => void;
  },
): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return false;

  let action: MarkdownAction | null = null;

  // Lower-case the key so Shift+B still resolves to bold.
  const k = e.key.toLowerCase();

  if (!e.shiftKey && k === 'b') action = 'bold';
  else if (!e.shiftKey && k === 'i') action = 'italic';
  else if (!e.shiftKey && k === '`') action = 'code';
  else if (e.shiftKey && k === '8') action = 'list';
  else if (e.shiftKey && k === '7') action = 'orderedList';
  else if (e.shiftKey && k === '.') action = 'quote';

  if (!action) return false;

  e.preventDefault();
  applyMarkdownAction({
    action,
    textarea: args.textarea,
    value: args.value,
    setValue: args.setValue,
  });
  return true;
}
