'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Props = {
  channels: { slug: string; name: string }[];
};

/**
 * Client island for the member directory filters. Pushes URL params on
 * submit so the RSC re-renders with the filtered list.
 *
 * Filters: search (handle / displayName / bio) + channel.
 * Note: the role filter was removed per user feedback ("on a pas besoin
 * de la recherche par rôle"). The `role` URL param is still tolerated by
 * the page, but the UI no longer surfaces it.
 */
export default function MemberFilters({ channels }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const t = useTranslations('community.members.filters');

  const [search, setSearch] = useState(sp.get('q') ?? '');
  const [channel, setChannel] = useState(sp.get('channel') ?? '');

  useEffect(() => {
    setSearch(sp.get('q') ?? '');
    setChannel(sp.get('channel') ?? '');
  }, [sp]);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set('q', search.trim());
    if (channel) next.set('channel', channel);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function reset() {
    setSearch('');
    setChannel('');
    router.push(pathname);
  }

  return (
    <form
      onSubmit={apply}
      className="dz-card"
      style={{
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'sticky',
        top: 88,
      }}
    >
      <label className="dz-small" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {t('search')}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          style={{
            padding: 10,
            borderRadius: 10,
            border: '1px solid rgba(36,50,95,0.18)',
            background: 'transparent',
            color: 'inherit',
            fontSize: 14,
          }}
        />
      </label>

      {channels.length > 0 && (
        <label className="dz-small" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {t('channels')}
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 10,
              border: '1px solid rgba(36,50,95,0.18)',
              background: 'transparent',
              color: 'inherit',
              fontSize: 14,
            }}
          >
            <option value="">{t('anyChannel')}</option>
            {channels.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="submit" className="dz-btn dz-btn-primary dz-btn-sm" style={{ flex: 1 }}>
          {t('applyCta')}
        </button>
        <button type="button" onClick={reset} className="dz-btn dz-btn-ghost dz-btn-sm">
          {t('reset')}
        </button>
      </div>
    </form>
  );
}
