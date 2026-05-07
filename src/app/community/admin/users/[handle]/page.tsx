import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

import { getCommunityViewer } from '../../../_components/viewer';
import UserModerationPanel from './_components/UserModerationPanel';
import TwoFactorResetPanel from './_components/TwoFactorResetPanel';

type Params = { handle: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { handle } = await params;
  const t = await getTranslations('community.admin.users');
  return { title: `${t('panelTitle')} — @${handle}` };
}

/**
 * `/community/admin/users/[handle]` — single-member moderation panel. Shows
 * activity counters, recent moderation history, and Mute/Suspend/Ban/Unban
 * buttons (client island).
 */
export default async function AdminUserPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) redirect('/community');

  const { handle } = await params;
  const t = await getTranslations('community.admin.users');
  const tStatus = await getTranslations('community.admin.users.statusLabels');

  const member = await prisma.communityMember.findUnique({
    where: { handle: handle.toLowerCase() },
    select: {
      id: true,
      userId: true,
      handle: true,
      displayName: true,
      bio: true,
      status: true,
      statusReason: true,
      statusUntil: true,
      isModerator: true,
      isFounder: true,
      isCoreTeam: true,
      joinedAt: true,
      postCount: true,
      commentCount: true,
      _count: { select: { reportsAgainst: true } },
      user: { select: { totpEnabledAt: true, role: true } },
    },
  });
  if (!member) notFound();

  // The 2FA reset panel is ADMIN-only; mods reaching this page see the
  // moderation panel but not the security-reset card. We refetch the
  // viewer's user role rather than trusting `viewer.isModerator` (which
  // is true for both ADMINs and CommunityMember.isModerator-only).
  const session = await auth();
  let viewerIsAdmin = false;
  let viewerUserId: string | null = null;
  if (session?.user?.id) {
    viewerUserId = session.user.id;
    const viewerUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    viewerIsAdmin = viewerUser?.role === 'ADMIN';
  }

  const history = await prisma.moderationAction.findMany({
    where: { targetMemberId: member.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      actor: { select: { handle: true } },
    },
  });

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div>
        <Link href="/community/admin/users" className="dz-small" style={{ fontSize: 13 }}>
          ← Membres
        </Link>
        <h2 className="dz-h2" style={{ fontSize: 22, marginTop: 6 }}>
          {t('panelTitle')} — @{member.handle}
        </h2>
        <p className="dz-small" style={{ fontSize: 12 }}>
          {t('memberSince', { date: member.joinedAt.toLocaleDateString('fr-FR') })}
        </p>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Stat label="Statut" value={tStatus(member.status)} />
        <Stat label="Posts" value={String(member.postCount)} />
        <Stat label="Commentaires" value={String(member.commentCount)} />
        <Stat label="Signalements reçus" value={String(member._count.reportsAgainst)} />
      </div>

      {member.statusReason ? (
        <div className="dz-card" style={{ padding: 14, fontSize: 13 }}>
          <strong>Note de statut :</strong> {member.statusReason}
          {member.statusUntil ? ` (jusqu'au ${member.statusUntil.toLocaleDateString('fr-FR')})` : null}
        </div>
      ) : null}

      <UserModerationPanel
        memberId={member.id}
        memberHandle={member.handle}
        currentStatus={member.status}
      />

      {viewerIsAdmin && (
        <TwoFactorResetPanel
          targetUserId={member.userId}
          targetHandle={member.handle}
          totpEnabledAt={member.user?.totpEnabledAt ?? null}
          isSelf={viewerUserId === member.userId}
        />
      )}

      <div>
        <h3 className="dz-h3" style={{ fontSize: 18, marginBottom: 10 }}>{t('modHistoryTitle')}</h3>
        {history.length === 0 ? (
          <p className="dz-small" style={{ fontSize: 13 }}>{t('modHistoryEmpty')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {history.map((h) => (
              <li key={h.id} className="dz-card" style={{ padding: 12, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{h.type}</strong>
                  <span className="dz-small" style={{ fontSize: 11 }}>
                    {h.createdAt.toLocaleString('fr-FR')}
                  </span>
                </div>
                {h.reason ? (
                  <div className="dz-small" style={{ fontSize: 12, marginTop: 4 }}>
                    {h.reason}
                  </div>
                ) : null}
                {h.actor ? (
                  <div className="dz-small" style={{ fontSize: 11, marginTop: 4 }}>
                    par @{h.actor.handle}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link href={`/community/members/${member.handle}`} className="dz-btn dz-btn-sm dz-btn-ghost" style={{ width: 'fit-content' }}>
        {t('actions.viewProfileCta')}
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="dz-card" style={{ padding: 14 }}>
      <div className="dz-small" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7 }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{value}</div>
    </div>
  );
}
