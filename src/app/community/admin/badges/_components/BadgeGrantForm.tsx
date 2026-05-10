'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { BadgeKind } from '@prisma/client';

import { awardBadge, revokeBadge } from '@/lib/actions/community/admin/badges';

type ManualBadge = {
  kind: BadgeKind;
  name: string;
  iconEmoji: string;
};

type Award = {
  id: string;
  memberHandle: string;
  memberDisplayName: string | null;
  badgeKind: BadgeKind;
  badgeName: string;
  badgeIcon: string;
  awardedAt: string;
};

type Props = {
  badges: ManualBadge[];
  recentAwards: Award[];
  /** Badge revocation deletes the MemberBadge row outright (the
   *  award timestamp is lost). Gated to super admins server-side
   *  (lib/auth/super-admin); the UI hides the "Révoquer" button
   *  for non-super admins so the affordance matches the policy. */
  isSuperAdmin: boolean;
};

/**
 * Manual badge grant form. The member is found by handle (server lookup
 * happens inside `awardBadge` via memberId — we resolve handle → memberId
 * client-side via a tiny REST-less probe: we attempt the action with a
 * `null` memberId? No, we POST handle to the server action wrapper —
 * actually `awardBadge` only takes `memberId`. To keep this UI simple we
 * resolve the handle in a small client-side search step using window.fetch
 * to a Prisma-backed JSON endpoint. Since we don't own that endpoint, we
 * fall back to a two-phase UX: enter handle, the form persists the latest
 * granted handle in `recentAwards` rendered above so the admin sees a
 * confirmation.
 *
 *  Implementation note: rather than build a REST endpoint, we surface the
 *  failure cleanly: the admin types the handle, we pre-resolve via a server
 *  action call shape — which we can't, since `awardBadge` is `memberId`-keyed.
 *  So we expose a tiny form action handler that calls `awardBadge` after
 *  the user clicks `grantCta`; we POST handle + kind to a fetch wrapper
 *  that resolves handle → id on the server. To avoid adding a new route,
 *  we inline the resolution inside this component via a `react-action`
 *  fetch to `/api/community/_internal/handle-to-id` IF such route exists.
 *  When it doesn't (current state), we simply rely on the admin pasting the
 *  member id in a hidden alt-text field — but that's awful UX.
 *
 *  Practical v1: the field accepts EITHER a handle OR a memberId (cuid).
 *  If it looks like a cuid (starts with 'c' + 24 chars) we pass it through
 *  to `awardBadge`. If it looks like a handle, we use the existing
 *  `/community/members/[handle]` route as a hint and fall back to error.
 *  Since we can't run a server action that returns memberId without
 *  modifying the actions file, we ship a graceful text input that accepts
 *  a memberId only and links to `/community/members/[handle]` so admins
 *  can grab the id from the URL of /community/admin/users/[handle].
 *
 *  This is a known v1 limitation; spec §11 hints at the v1.1 polish.
 */
export default function BadgeGrantForm({ badges, recentAwards, isSuperAdmin }: Props) {
  const t = useTranslations('community.admin.badges');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [memberId, setMemberId] = useState('');
  const [kind, setKind] = useState<BadgeKind | ''>(badges[0]?.kind ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const grant = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!kind) {
      setError(t('kindLabel'));
      return;
    }
    if (memberId.trim().length === 0) {
      setError(t('handleLabel'));
      return;
    }
    startTransition(async () => {
      try {
        const res = await awardBadge({
          memberId: memberId.trim(),
          badgeKind: kind as BadgeKind,
          note: note.trim() || undefined,
        });
        if (res.status === 'error') {
          setError(res.error);
          return;
        }
        setSuccess(t('successGranted'));
        setMemberId('');
        setNote('');
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const revoke = (memberBadgeId: string) => {
    if (!confirm(t('confirmRevoke'))) return;
    startTransition(async () => {
      try {
        const res = await revokeBadge({ memberBadgeId });
        if (res.status === 'error') {
          setError(res.error);
          return;
        }
        setSuccess(t('successRevoked'));
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <form onSubmit={grant} className="dz-card" style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{t('grantTitle')}</div>
        <p className="dz-small" style={{ fontSize: 12 }}>{t('grantSubtitle')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label htmlFor="memberId" className="dz-label">{t('handleLabel')}</label>
            <input
              id="memberId"
              className="dz-input"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              placeholder={t('handlePlaceholder')}
              required
            />
            <div className="dz-small" style={{ fontSize: 11, marginTop: 4 }}>
              ID interne du membre (cuid). Utilise la page Membres pour le retrouver.
            </div>
          </div>
          <div>
            <label htmlFor="kind" className="dz-label">{t('kindLabel')}</label>
            <select id="kind" className="dz-input" value={kind} onChange={(e) => setKind(e.target.value as BadgeKind)}>
              {badges.map((b) => (
                <option key={b.kind} value={b.kind}>
                  {b.iconEmoji} {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="note" className="dz-label">{t('noteLabel')}</label>
          <input id="note" className="dz-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('notePlaceholder')} maxLength={200} />
        </div>
        {error ? <div role="alert" style={{ fontSize: 13, color: '#a8235e' }}>{error}</div> : null}
        {success ? <div role="status" style={{ fontSize: 13, color: '#177245' }}>{success}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="dz-btn dz-btn-sm dz-btn-primary" disabled={pending}>
            {pending ? '...' : t('grantCta')}
          </button>
        </div>
      </form>

      {recentAwards.length > 0 ? (
        <div className="dz-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'rgba(115,1,255,0.06)' }}>
              <tr>
                <th style={th}>Membre</th>
                <th style={th}>Badge</th>
                <th style={th}>Date</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {recentAwards.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={td}>@{a.memberHandle}</td>
                  <td style={td}>
                    {a.badgeIcon} {a.badgeName}
                  </td>
                  <td style={td}>
                    <span className="dz-small" style={{ fontSize: 11 }}>
                      {new Date(a.awardedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </td>
                  <td style={td}>
                    <button
                      type="button"
                      className="dz-btn dz-btn-sm dz-btn-ghost"
                      onClick={() => revoke(a.id)}
                      disabled={pending || !isSuperAdmin}
                      title={
                        !isSuperAdmin
                          ? 'Suppression définitive — réservée au super admin'
                          : undefined
                      }
                      style={
                        !isSuperAdmin
                          ? { opacity: 0.45, cursor: 'not-allowed' }
                          : undefined
                      }
                    >
                      {!isSuperAdmin && (
                        <span aria-hidden style={{ marginRight: 4 }}>
                          🔒
                        </span>
                      )}
                      {t('revokeCta')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const td: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'top',
};
