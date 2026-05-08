import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { routing, type Locale } from './routing';

/**
 * Per-request locale resolution + message merging.
 *
 * Resolution order (first match wins):
 *   1. `NEXT_LOCALE` cookie — set by `<LocaleSwitcher>`. Persists user
 *      choice across visits.
 *   2. `Accept-Language` header — best guess for first-visit users.
 *      We pick the first supported locale in the prioritised list.
 *   3. `routing.defaultLocale` (`fr`).
 *
 * Message merging — for every locale except the default, we deep-
 * merge that locale's bundle ON TOP of the French bundle. Missing
 * EN keys gracefully fall through to FR instead of throwing or
 * showing the raw key. This lets us ship a partial en.json and
 * progressively translate without breaking the UI.
 */

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, overlay: Messages): Messages {
  const out: Messages = { ...base };
  for (const k of Object.keys(overlay)) {
    const a = base[k];
    const b = overlay[k];
    if (
      a &&
      b &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      out[k] = deepMerge(a as Messages, b as Messages);
    } else {
      out[k] = b;
    }
  }
  return out;
}

function isSupportedLocale(value: string | undefined): value is Locale {
  return value !== undefined && (routing.locales as readonly string[]).includes(value);
}

async function resolveLocale(): Promise<Locale> {
  // `cookies()` and `headers()` throw when called outside a request
  // context — notably inside `generateStaticParams`, which Next.js
  // runs at build time with no HTTP request attached. Catch that
  // case and fall back to the default locale so static-param
  // generation keeps working without a special-case in every page.
  try {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get('NEXT_LOCALE')?.value;
    if (isSupportedLocale(fromCookie)) return fromCookie;

    const headerStore = await headers();
    const accept = headerStore.get('accept-language') ?? '';
    // Cheap parse: take the first comma-separated tag, drop the q-value
    // and region suffix. Good enough for fr-FR / en-US / fr / en, which
    // is the entire universe we care about today.
    for (const tag of accept.split(',')) {
      const lang = tag.split(';')[0]?.trim().slice(0, 2).toLowerCase();
      if (isSupportedLocale(lang)) return lang;
    }
  } catch {
    // No request context — likely build-time static param generation.
  }
  return routing.defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const fr = (await import('../../messages/fr.json')).default as Messages;
  if (locale === 'fr') {
    return { locale, messages: fr };
  }
  const overlay = (await import(`../../messages/${locale}.json`)).default as Messages;
  return { locale, messages: deepMerge(fr, overlay) };
});
