import 'server-only';
import { cache } from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { viewerTimeZone, type FormatOptions } from './format';

/**
 * Time zone (from the viewer's mentor or mentee profile, default
 * Europe/Paris) and active locale to pass to the `@/lib/mentora/format`
 * formatters in server components. One query per request.
 */
export const getViewerFormat = cache(async (userId: string): Promise<Required<FormatOptions>> => {
  const [user, locale] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        mentorProfile: { select: { timezone: true } },
        menteeProfile: { select: { timezone: true } },
      },
    }),
    getLocale(),
  ]);
  return {
    timeZone: viewerTimeZone({
      mentorTimeZone: user?.mentorProfile?.timezone,
      menteeTimeZone: user?.menteeProfile?.timezone,
    }),
    locale,
  };
});
