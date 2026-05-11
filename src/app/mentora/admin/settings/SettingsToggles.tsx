'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

import { updateMentoratProgrammeSettings } from '@/lib/actions/platform-settings';

/**
 * Single-toggle button bound to a `MentoratProgrammeSettings`
 * boolean field. Optimistic flip with rollback on error, same
 * pattern as the community variant.
 */
export function MentoratBoolToggle({
  field,
  initialOn,
}: {
  field: 'require2faAdmin';
  initialOn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [on, setOn] = useState(initialOn);

  const flip = () => {
    const target = !on;
    setOn(target);
    startTransition(async () => {
      const res = await updateMentoratProgrammeSettings({ [field]: target });
      if (res.status === 'error') {
        setOn(!target);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={flip}
      disabled={pending}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: on ? '#23c55e' : 'rgba(115,1,255,0.15)',
        position: 'relative',
        flexShrink: 0,
        display: 'inline-block',
        border: 'none',
        cursor: pending ? 'wait' : 'pointer',
        padding: 0,
        opacity: pending ? 0.6 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'white',
          transition: 'left 150ms ease',
        }}
      />
    </button>
  );
}
