'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

import { updateCommunitySettings } from '@/lib/actions/platform-settings';

type ToggleKey =
  | 'requireCharterAccept'
  | 'openToVisitors'
  | 'noIndex';

/**
 * Single-toggle button bound to a CommunitySettings boolean field.
 *
 * Optimistic flip: we mutate local state immediately, fire the
 * action, and rollback on error. `router.refresh()` re-syncs the
 * server state on success so any related copy updates.
 */
export function CommunityBoolToggle({
  field,
  initialOn,
}: {
  field: ToggleKey;
  initialOn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [on, setOn] = useState(initialOn);

  const flip = () => {
    const target = !on;
    setOn(target);
    startTransition(async () => {
      const res = await updateCommunitySettings({ [field]: target });
      if (res.status === 'error') {
        // Rollback the optimistic flip.
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

/**
 * Numeric stepper bound to `autoSanctionThreshold` or
 * `quarantineDays`. Renders a "+ / −" pair so admins can adjust
 * without typing.
 */
export function CommunityNumberStepper({
  field,
  initialValue,
  min = 0,
  max = 60,
  unit,
}: {
  field: 'autoSanctionThreshold' | 'quarantineDays';
  initialValue: number;
  min?: number;
  max?: number;
  unit: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialValue);

  const apply = (next: number) => {
    const clamped = Math.max(min, Math.min(max, next));
    if (clamped === value) return;
    setValue(clamped);
    startTransition(async () => {
      const res = await updateCommunitySettings({ [field]: clamped });
      if (res.status === 'error') {
        setValue(value);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={() => apply(value - 1)}
        disabled={pending || value <= min}
        aria-label="−"
        style={stepBtn}
      >
        −
      </button>
      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>
        {value} {unit}
      </span>
      <button
        type="button"
        onClick={() => apply(value + 1)}
        disabled={pending || value >= max}
        aria-label="+"
        style={stepBtn}
      >
        +
      </button>
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 7,
  border: '1px solid rgba(115,1,255,0.20)',
  background: 'transparent',
  color: '#7301FF',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};
