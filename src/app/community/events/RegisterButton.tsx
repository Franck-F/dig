'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { toggleEventRegistration } from '@/lib/actions/events';

/**
 * One-click register / cancel CTA for a community event.
 *
 * The action is idempotent on the server (single unique row per
 * `(eventId, userId)` with a soft `cancelledAt` flip), so we can
 * optimistically reflect the new state by calling `router.refresh()`
 * after the transition resolves.
 */
export default function RegisterButton({
  eventId,
  registered,
  registeredLabel,
  registerLabel,
  accent,
}: {
  eventId: string;
  registered: boolean;
  registeredLabel: string;
  registerLabel: string;
  accent: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await toggleEventRegistration(eventId);
      if (res.status === 'success') router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      style={{
        padding: '8px 16px',
        borderRadius: 10,
        border: 'none',
        background: registered ? '#23c55e' : `${accent}18`,
        color: registered ? 'white' : accent,
        fontSize: 12,
        fontWeight: 700,
        cursor: pending ? 'wait' : 'pointer',
        flexShrink: 0,
        fontFamily: 'inherit',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {registered ? registeredLabel : registerLabel}
    </button>
  );
}
