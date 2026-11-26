/**
 * Dashboard date formatters. The implementation lives in
 * `@/lib/mentora/format` (time-zone and locale aware, tested); pass the
 * viewer's `timeZone` and the active `locale` wherever a time is shown.
 */
export { dayBucket, fmtDate, fmtDateTime, fmtParts, fmtTime } from '@/lib/mentora/format';
