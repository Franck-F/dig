/**
 * Backwards-compat re-export. The `normaliseQuery` helper used to live
 * here exclusively (community Posts FTS); P8 #75 promoted it to
 * `@/lib/search/tsquery` so MentorProfile FTS could share it. Existing
 * imports (incl. tests in `__tests__/search.test.ts`) keep working
 * unchanged via this barrel.
 */
export { normaliseQuery } from '@/lib/search/tsquery';
