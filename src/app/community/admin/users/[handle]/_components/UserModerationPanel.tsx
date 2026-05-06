'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  muteUser,
  suspendUser,
  banUser,
  unbanUser,
  warnAuthor,
} from '@/lib/actions/community/admin/moderation';

type Status = 'ACTIVE' | 'MUTED' | 'SUSPENDED' | 'BANNED' | string;

type Action = 'WARN' | 'MUTE' | 'SUSPEND' | 'BAN' | 'UNBAN';

const VARIANTS: Record<Action, { className: string; allowedFrom: Status[] }> = {
  WARN: { className: 'dz-btn dz-btn-sm dz-btn-ghost', allowedFrom: ['ACTIVE', 'MUTED'] },
  MUTE: { className: 'dz-btn dz-btn-sm dz-btn-ghost', allowedFrom: ['ACTIVE'] },
  SUSPEND: { className: 'dz-btn dz-btn-sm dz-btn-ghost', allowedFrom: ['ACTIVE', 'MUTED'] },
  BAN: { className: 'dz-btn dz-btn-sm dz-btn-primary', allowedFrom: ['ACTIVE', 'MUTED', 'SUSPENDED'] },
  UNBAN: { className: 'dz-btn dz-btn-sm dz-btn-primary', allowedFrom: ['MUTED', 'SUSPENDED', 'BANNED'] },
};

export default function UserModerationPanel({
  memberId,
  memberHandle,
  currentStatus,
}: {
  memberId: string;
  memberHandle: string;
  currentStatus: Status;
}) {
  const t = useTranslations('community.admin.users.actions');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = (action: Action) => {
    setActive(action);
    setReason('');
    setError(null);
  };
  const close = () => {
    setActive(null);
    setReason('');
    setError(null);
  };

  const submit = () => {
    if (!active) return;
    setError(null);
    startTransition(async () => {
      try {
        const trimmed = reason.trim();
        if (active !== 'UNBAN' && trimmed.length === 0) {
          setError(t('reasonRequired'));
          return;
        }
        let res: { status?: string; error?: string } | undefined;
        switch (active) {
          case 'WARN':
            res = await warnAuthor({ memberId, reason: trimmed });
            break;
          case 'MUTE':
            res = await muteUser({ memberId, reason: trimmed });
            break;
          case 'SUSPEND':
            res = await suspendUser({ memberId, reason: trimmed });
            break;
          case 'BAN':
            res = await banUser({ memberId, reason: trimmed });
            break;
          case 'UNBAN':
            res = await unbanUser({ memberId });
            break;
        }
        if (res && res.status === 'error') {
          setError(res.error ?? t('genericError'));
          return;
        }
        close();
        router.refresh();
      } catch {
        setError(t('genericError'));
      }
    });
  };

  return (
    <div className="dz-card" style={{ padding: 16 }}>
      <h3 className="dz-h3" style={{ fontSize: 16, marginBottom: 12 }}>
        {t('panelTitle')}
      </h3>
      <p className="dz-small" style={{ fontSize: 12, marginBottom: 14 }}>
        {t('panelSubtitle', { handle: memberHandle })}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(['WARN', 'MUTE', 'SUSPEND', 'BAN', 'UNBAN'] as const).map((a) => {
          const variant = VARIANTS[a];
          const enabled = variant.allowedFrom.includes(currentStatus);
          return (
            <button
              key={a}
              type="button"
              className={variant.className}
              disabled={!enabled || pending}
              onClick={() => open(a)}
              style={{ opacity: enabled ? 1 : 0.45 }}
            >
              {t(a.toLowerCase())}
            </button>
          );
        })}
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,10,46,0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
          onClick={close}
        >
          <div
            className="dz-glass-strong"
            style={{ width: '100%', maxWidth: 460, padding: 24, borderRadius: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="dz-h3" style={{ fontSize: 18, marginBottom: 8 }}>
              {t(`confirm.${active.toLowerCase()}.title`)}
            </h4>
            <p className="dz-small" style={{ fontSize: 13, marginBottom: 14 }}>
              {t(`confirm.${active.toLowerCase()}.body`, { handle: memberHandle })}
            </p>

            <label htmlFor="mod-reason" className="dz-label">
              {t('reasonLabel')}
            </label>
            <textarea
              id="mod-reason"
              className="dz-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              style={{ width: '100%', resize: 'vertical' }}
            />

            {error && (
              <div role="alert" style={{ marginTop: 10, fontSize: 13, color: '#a8235e' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="dz-btn dz-btn-sm dz-btn-ghost" onClick={close} disabled={pending}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="dz-btn dz-btn-sm dz-btn-primary"
                onClick={submit}
                disabled={pending}
                style={{ opacity: pending ? 0.7 : 1 }}
              >
                {pending ? t('submitting') : t('confirm.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
