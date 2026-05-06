'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { joinChannel, leaveChannel, requestChannelJoin } from '@/lib/actions/community/channels';

type State = 'NONE' | 'ACTIVE' | 'PENDING' | 'INVITE_ONLY';

type Props = {
  slug: string;
  type: 'PUBLIC' | 'RESTRICTED' | 'PRIVATE' | 'ANNOUNCEMENT';
  initialState: State;
  /** When false, button is disabled with a login link tooltip. */
  canAct: boolean;
};

/**
 * Toggle membership for a community channel.
 *
 * Earlier this component just `await fn()` without checking the action's
 * `ActionResult` shape, and silently caught all errors. The user reported the
 * button "ne fonctionne pas" — clicking did nothing visible because the
 * action returned `{ status: 'error', ... }` and the optimistic state was
 * still applied locally, then `router.refresh()` reverted it. Now we read
 * the result, surface the error inline, and only flip the state on success.
 */
export default function JoinChannelButton({ slug, type, initialState, canAct }: Props) {
  const t = useTranslations('community.channels');
  const [state, setState] = useState<State>(initialState);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function call(fn: 'join' | 'leave' | 'request') {
    if (!canAct || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const action = fn === 'join' ? joinChannel : fn === 'leave' ? leaveChannel : requestChannelJoin;
        const res = await (action as (i: { slug: string }) => Promise<{ status: string; error?: string; data?: unknown }>)({ slug });
        if (res.status === 'error') {
          setError(res.error ?? 'unknown');
          return;
        }
        if (fn === 'join') {
          // Server tells us the actual resulting status (ACTIVE for PUBLIC,
          // PENDING for RESTRICTED).
          const data = res.data as { status?: 'ACTIVE' | 'PENDING' } | undefined;
          setState(data?.status ?? 'ACTIVE');
        } else if (fn === 'leave') {
          setState('NONE');
        } else {
          setState('PENDING');
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'unknown');
      }
    });
  }

  if (type === 'ANNOUNCEMENT') return null;

  if (type === 'PRIVATE' && state !== 'ACTIVE') {
    return (
      <span className="dz-chip" style={{ fontSize: 12 }}>
        {t('inviteOnlyLabel')}
      </span>
    );
  }

  let button: React.ReactNode;
  if (state === 'ACTIVE') {
    button = (
      <button
        type="button"
        onClick={() => call('leave')}
        className="dz-btn dz-btn-ghost dz-btn-sm"
        disabled={!canAct || pending}
        aria-busy={pending}
      >
        {pending ? '…' : t('leaveCta')}
      </button>
    );
  } else if (state === 'PENDING') {
    button = (
      <span className="dz-chip" style={{ fontSize: 12 }}>
        {t('joinPendingLabel')}
      </span>
    );
  } else if (type === 'RESTRICTED') {
    button = (
      <button
        type="button"
        onClick={() => call('request')}
        className="dz-btn dz-btn-primary dz-btn-sm"
        disabled={!canAct || pending}
        aria-busy={pending}
      >
        {pending ? '…' : t('requestJoinCta')}
      </button>
    );
  } else {
    button = (
      <button
        type="button"
        onClick={() => call('join')}
        className="dz-btn dz-btn-primary dz-btn-sm"
        disabled={!canAct || pending}
        aria-busy={pending}
      >
        {pending ? '…' : t('joinCta')}
      </button>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        {button}
        <span style={{ fontSize: 11, color: '#d94e92' }}>
          {error}
        </span>
      </div>
    );
  }
  return button;
}
