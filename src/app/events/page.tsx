import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import Frame from '@/components/Frame';
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  eventJsonLd,
  itemListJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';

import EventsClient from './EventsClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('events');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function EventsPage() {
  const t = await getTranslations('events');

  const upcoming = ['0', '1', '2', '3'] as const;

  // Build Event JSON-LD entries from translation keys (iso, online, venue,
  // city were added to messages/fr.json so the schema validates).
  const eventLdItems = upcoming.map((i) => {
    const isOnline = (t.raw(`upcoming.${i}.online`) as boolean) === true;
    return eventJsonLd({
      name: t(`upcoming.${i}.title`),
      startDate: t(`upcoming.${i}.iso`),
      locationName: t(`upcoming.${i}.venue`),
      locationCity: t(`upcoming.${i}.city`),
      description: `${t(`upcoming.${i}.tag`)} — ${t(`upcoming.${i}.title`)}`,
      url: '/events',
      attendanceMode: isOnline
        ? 'OnlineEventAttendanceMode'
        : 'OfflineEventAttendanceMode',
    });
  });

  // Highlight event mentioned in the hero section.
  const heroEventLd = eventJsonLd({
    name: 'Digizelle Impact #1 — Epitech Paris',
    startDate: '2026-03-13',
    locationName: 'Epitech Paris',
    locationCity: 'Paris',
    description: t('hero.body'),
    url: '/events',
    attendanceMode: 'OfflineEventAttendanceMode',
  });

  return (
    <Frame active="events">
      {/* JSON-LD: CollectionPage + Breadcrumb + ItemList of upcoming Events. */}
      <script
        {...jsonLdScriptProps(
          collectionPageJsonLd({
            url: '/events',
            name: t('metaTitle'),
            description: t('metaDescription'),
          }),
        )}
      />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('metaTitle'), url: '/events' },
          ]),
        )}
      />
      <script {...jsonLdScriptProps(heroEventLd)} />
      {eventLdItems.map((ld, i) => (
        <script key={`evt-${i}`} {...jsonLdScriptProps(ld)} />
      ))}
      <script
        {...jsonLdScriptProps(
          itemListJsonLd({
            name: 'Prochains événements Digizelle',
            url: '/events',
            items: upcoming.map((i) => ({
              name: t(`upcoming.${i}.title`),
            })),
          }),
        )}
      />

      <EventsClient />
    </Frame>
  );
}
