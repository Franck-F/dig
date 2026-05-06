'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { dismissReport, resolveReport } from '@/lib/actions/community/admin/moderation';

type Props = {
  reportId: string;
  /** When the report targets a member (post or comment author), we use this
   *  for the warn/ban path (resolveReport handles WARN/BAN via resolution). */
  targetMemberId: string | null;
  /** True when the report points at a Post or Comment (not just a member). */
  hasContent: boolean;
};

type ActionKind = 'remove' | 'warn' | 'ban' | 'dismiss';

/**
 * Inline per-row moderation actions. Shows a confirmation dialog before
 * firing one of `resolveReport({resolution:'remove'|'warn'|'ban'})` or
 * `dismissReport`. We use `resolveReport` for all three resolution flavors
 * so the report row is updated in the same transaction.
 */
export default function ModerationQueueRowActions({ reportId, targetMemberId, hasContent }: Props) {
  const t = useTranslations('community.admin.moderation');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmFor, setConfirmFor] = useState<ActionKind | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const trigger = (kind: ActionKind) => {
    setError(null);
    setNote('');
    setConfirmFor(kind);
  };

  const cancel = () => {
    if (pending) return;
    setConfirmFor(null);
    setNote('');
    setError(null);
  };

  const fire = () => {
    if (!confirmFor) return;
    setError(null);
    startTransition(async () => {
      try {
        let res;
        if (confirmFor === 'dismiss') {
          res = await dismissReport({ reportId, note: note.trim() || undefined });
        } else {
          res = await resolveReport({
            reportId,
            resolution: confirmFor,
            resolutionNote: note.trim() || undefined,
          });
        }
        if (res.status === 'error') {
          setError(res.error);
          return;
        }
        setConfirmFor(null);
        setNote('');
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  if (confirmFor) {
    const titleKey = confirmFor === 'remove'
      ? 'confirm.removeTitle'
      : confirmFor === 'warn'
        ? 'confirm.warnTitle'
        : confirmFor === 'ban'
          ? 'confirm.banTitle'
          : 'confirm.dismissTitle';
    const bodyKey = confirmFor === 'remove'
      ? 'confirm.removeBody'
      : confirmFor === 'warn'
        ? 'confirm.warnBody'
        : confirmFor === 'ban'
          ? 'confirm.banBody'
          : 'confirm.dismissBody';

    return (
      <div
        className="dz-card"
        role="alertdialog"
        aria-modal="false"
        style={{ padding: 12, fontSize: 12, display: 'grid', gap: 8, minWidth: 240 }}
      >
        <div style={{ fontWeight: 700 }}>{t(titleKey)}</div>
        <div className="dz-small" style={{ fontSize: 11 }}>{t(bodyKey)}</div>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder={t('notePlaceholder')}
          className="dz-input"
          style={{ fontSize: 12 }}
        />
        {error ? (
          <div role="alert" style={{ fontSize: 11, color: '#a8235e' }}>{error}</div>
        ) : null}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button type="button" className="dz-btn dz-btn-sm dz-btn-ghost" disabled={pending} onClick={cancel}>
            {t('confirm.cancel')}
          </button>
          <button type="button" className="dz-btn dz-btn-sm dz-btn-primary" disabled={pending} onClick={fire}>
            {pending ? '...' : t('confirm.confirm')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {hasContent ? (
        <button type="button" className="dz-btn dz-btn-sm dz-btn-ghost" onClick={() => trigger('remove')}>
          {t('actions.remove')}
        </button>
      ) : null}
      {targetMemberId ? (
        <>
          <button type="button" className="dz-btn dz-btn-sm dz-btn-ghost" onClick={() => trigger('warn')}>
            {t('actions.warn')}
          </button>
          <button type="button" className="dz-btn dz-btn-sm dz-btn-ghost" onClick={() => trigger('ban')}>
            {t('actions.ban')}
          </button>
        </>
      ) : null}
      <button type="button" className="dz-btn dz-btn-sm dz-btn-ghost" onClick={() => trigger('dismiss')}>
        {t('actions.dismiss')}
      </button>
    </div>
  );
}
