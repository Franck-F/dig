'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { errorKeyFor } from './errors';

/**
 * Turn the `error` string of a Mentora action result into display text:
 * `mentora.errors.<code>` (or a bare known code) is translated, anything
 * else is assumed to be human-readable already and passed through.
 */
export function useActionErrorMessage(): (raw: string | null | undefined) => string {
  const t = useTranslations('mentora');
  return useCallback(
    (raw: string | null | undefined) => {
      const key = errorKeyFor(raw);
      return key ? t(key as never) : (raw ?? '');
    },
    [t],
  );
}
