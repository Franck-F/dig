import { z } from 'zod';

/**
 * `z.string().url()` accepts `javascript:` and `data:` URLs, which end up
 * in `href` attributes (M14). User-supplied links must be http(s).
 */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export const httpUrlSchema = z.string().url().refine(isHttpUrl);
