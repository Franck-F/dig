'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { searchMentionCandidates, type MentionMatch } from '@/lib/actions/community/mentions-search';

/**
 * Mention-autocomplete wrapper around a `<textarea>`. Lights up a
 * floating list of matching handles when the user types `@xxx`,
 * arrow-keys / Enter to pick, Esc to dismiss.
 *
 * Detection rule (must match the server-side parser in
 * `src/lib/community/mentions.ts`):
 *   - `@` immediately preceded by start-of-string OR a non
 *     [a-z0-9_] character (mirrors the negative lookbehind in
 *     MENTION_REGEX, simplified for client-side detection).
 *   - At least 1 alnum/underscore char after the @ before we fire
 *     a search; we never autocomplete on a bare @.
 *
 * Insertion replaces the in-progress `@xxx` substring with
 * `@<handle>` (no space appended — feels more natural in flows
 * like "@alice, what do you think?").
 *
 * Keyboard:
 *   ArrowUp / ArrowDown — move selection (clamped)
 *   Enter / Tab        — accept currently-selected match
 *   Escape             — dismiss
 *
 * Accessibility: the textarea gets an `aria-controls` link to the
 * listbox + `aria-activedescendant` updated as the user navigates.
 * Listbox is `role="listbox"`, options `role="option"`.
 */

const DEBOUNCE_MS = 120;

export type MentionAutocompleteHandle = HTMLTextAreaElement;

type Props = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange'
> & {
  /** Controlled value — the autocomplete needs to read + replace. */
  value: string;
  /** Setter, called on every textarea change AND when a mention is picked. */
  onChange: (next: string) => void;
};

const MentionAutocomplete = forwardRef<HTMLTextAreaElement, Props>(
  function MentionAutocomplete(props, forwardedRef) {
    const { value, onChange, onKeyDown, ...textareaProps } = props;
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(forwardedRef, () => localRef.current!, []);

    const [matches, setMatches] = useState<MentionMatch[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [tokenStart, setTokenStart] = useState(0);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Detect the in-progress @-token at the cursor.
    function detectToken(text: string, cursorPos: number) {
      // Scan backwards from cursor to find @ or invalid char.
      let i = cursorPos - 1;
      while (i >= 0) {
        const c = text[i];
        if (c === '@') {
          const before = i === 0 ? '' : text[i - 1];
          // Only trigger when @ is at start or after a non-handle char
          // (mirrors the server-side parser's "not after [a-z0-9_]").
          if (before === '' || !/[a-zA-Z0-9_]/.test(before)) {
            const candidate = text.slice(i + 1, cursorPos);
            // Cap at 30 (handle max) and reject if it contains a space.
            if (candidate.length <= 30 && /^[a-zA-Z0-9_]*$/.test(candidate)) {
              return { start: i, query: candidate };
            }
          }
          return null;
        }
        if (!/[a-zA-Z0-9_]/.test(c)) return null;
        i -= 1;
      }
      return null;
    }

    // Run search after debounce when the query changes.
    useEffect(() => {
      if (!open) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const captured = query;
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await searchMentionCandidates(captured);
          setMatches(res);
          setActiveIdx(0);
        } catch {
          setMatches([]);
        }
      }, DEBOUNCE_MS);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, [query, open]);

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
      const next = e.target.value;
      onChange(next);
      const pos = e.target.selectionStart ?? next.length;
      const detected = detectToken(next, pos);
      if (detected) {
        setOpen(true);
        setQuery(detected.query);
        setTokenStart(detected.start);
      } else {
        setOpen(false);
      }
    }

    function pick(match: MentionMatch) {
      const ta = localRef.current;
      if (!ta) return;
      const cursor = ta.selectionStart ?? value.length;
      const replaced =
        value.slice(0, tokenStart) + `@${match.handle}` + value.slice(cursor);
      onChange(replaced);
      setOpen(false);
      // Reset cursor after the inserted handle (defer to next tick so
      // React has flushed the new value to the DOM).
      const newCursor = tokenStart + 1 + match.handle.length;
      requestAnimationFrame(() => {
        ta.selectionStart = newCursor;
        ta.selectionEnd = newCursor;
      });
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (open && matches.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIdx((i) => Math.min(matches.length - 1, i + 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIdx((i) => Math.max(0, i - 1));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          pick(matches[activeIdx]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setOpen(false);
          return;
        }
      }
      onKeyDown?.(e);
    }

    const listboxId = 'dz-mention-listbox';

    return (
      <div style={{ position: 'relative' }}>
        <textarea
          {...textareaProps}
          ref={localRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={(e) => {
            // Defer hiding so a click on a listbox item still fires.
            setTimeout(() => setOpen(false), 120);
            textareaProps.onBlur?.(e);
          }}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={
            open && matches.length > 0 ? `dz-mention-opt-${activeIdx}` : undefined
          }
          aria-autocomplete="list"
        />

        {open && matches.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              maxHeight: 240,
              overflowY: 'auto',
              minWidth: 220,
              padding: 4,
              listStyle: 'none',
              background: 'white',
              border: '1px solid rgba(115,1,255,0.20)',
              borderRadius: 12,
              boxShadow: '0 12px 32px rgba(115,1,255,0.18)',
              zIndex: 50,
            }}
          >
            {matches.map((m, i) => {
              const active = i === activeIdx;
              return (
                <li
                  key={m.handle}
                  id={`dz-mention-opt-${i}`}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => {
                    // Prevent the textarea from losing focus before pick().
                    e.preventDefault();
                    pick(m);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: active ? 'rgba(115,1,255,0.08)' : 'transparent',
                  }}
                >
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatarUrl}
                      alt=""
                      width={28}
                      height={28}
                      style={{ borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {m.handle.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>
                      @{m.handle}
                    </div>
                    {m.displayName && (
                      <div style={{ fontSize: 11, color: '#8b91ad' }}>{m.displayName}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  },
);

export default MentionAutocomplete;
