'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ChallengeStatus } from '@prisma/client';

import {
  closeChallengeManually,
  publishChallenge,
} from '@/lib/actions/community/admin/challenges';

type Props = {
  id: string;
  status: ChallengeStatus;
};

/**
 * Inline lifecycle controls. The action varies by current status:
 *   DRAFT   → Publier (DRAFT → OPEN, broadcasts CHALLENGE_NEW)
 *   OPEN    → Passer au vote (OPEN → VOTING)
 *   VOTING  → Clore le défi (VOTING → CLOSED, computes winners)
 *   CLOSED  → no action
 */
export default function ChallengeRowActions({ id, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === 'CLOSED') return null;

  const config = (() => {
    if (status === 'DRAFT') {
      return {
        label: 'Publier',
        confirm:
          'Publier ce défi ? Tous les membres actifs recevront une notification.',
        run: () => publishChallenge({ id }),
      };
    }
    if (status === 'OPEN') {
      return {
        label: 'Passer au vote',
        confirm:
          'Clore les soumissions et passer en phase de vote ? Les nouvelles soumissions seront refusées.',
        run: () => closeChallengeManually({ id }),
      };
    }
    return {
      label: 'Clore le défi',
      confirm:
        'Clore le défi ? Le podium est calculé automatiquement à partir des votes.',
      run: () => closeChallengeManually({ id }),
    };
  })();

  const onClick = () => {
    if (typeof window !== 'undefined' && !window.confirm(config.confirm)) return;
    setError(null);
    startTransition(async () => {
      const res = await config.run();
      if (res.status === 'error') {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          border: 'none',
          background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
          color: 'white',
          fontSize: 11,
          fontWeight: 700,
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? 0.7 : 1,
          boxShadow: '0 6px 14px rgba(115,1,255,0.30)',
          whiteSpace: 'nowrap',
        }}
      >
        {pending ? '…' : config.label}
      </button>
      {error && (
        <span style={{ color: '#a8235e', fontSize: 10 }}>{error}</span>
      )}
    </div>
  );
}
