import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getCommunityViewer } from '../_components/viewer';
import AdminNav from './_components/AdminNav';

/**
 * `/community/admin/**` shell. Top-of-tree gate: viewer must be a community
 * member AND either UserRole = ADMIN or `member.isModerator = true`. Anyone
 * else is bounced to the public feed (we deliberately don't 404 — that would
 * leak the existence of the route).
 *
 *  Renders a sticky sidebar with section links + the active page content.
 */
export default async function CommunityAdminLayout({ children }: { children: ReactNode }) {
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) {
    // Soft denial — don't reveal the route to non-mods.
    redirect('/community');
  }

  const t = await getTranslations('community.admin');

  return (
    <section className="dz-section" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/community" className="dz-small" style={{ fontSize: 13 }}>
            {t('backToCommunity')}
          </Link>
          <h1 className="dz-h1" style={{ fontSize: 30, marginTop: 8 }}>
            {t('title')}
          </h1>
          <p className="dz-small" style={{ marginTop: 6, fontSize: 14 }}>{t('subtitle')}</p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 1fr',
            gap: 32,
            alignItems: 'start',
          }}
          className="dz-admin-grid"
        >
          <aside style={{ position: 'sticky', top: 96 }}>
            <AdminNav />
          </aside>
          <div style={{ minWidth: 0 }}>{children}</div>
        </div>
      </div>
    </section>
  );
}
