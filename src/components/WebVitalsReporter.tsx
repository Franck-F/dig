'use client';

import { useReportWebVitals } from 'next/web-vitals';
import * as Sentry from '@sentry/nextjs';

/**
 * Reports Core Web Vitals (LCP, INP, CLS, TTFB, FCP) to Sentry as
 * measurements attached to a "web-vitals" transaction. Mounted once
 * from the root layout — Next.js's `useReportWebVitals` is the
 * supported API and fires per metric per page load.
 *
 * Why not just `console.log`? In production we lose them. Why not a
 * dedicated analytics endpoint? Sentry already has the page-load
 * transaction infrastructure and the ingestion is free under our
 * existing plan. The metrics show up alongside any errors that
 * happened on the same page-load — so a slow LCP that correlates
 * with a server error is one click away.
 *
 * Sample rate: 100 % at this scale. If we ever cross the Sentry quota
 * we sample-down by adding `if (Math.random() > 0.25) return;`.
 *
 * Names reported (matches the CWV vocabulary):
 *  - LCP — Largest Contentful Paint (ms)
 *  - INP — Interaction to Next Paint (ms)
 *  - CLS — Cumulative Layout Shift (score, no unit)
 *  - FCP — First Contentful Paint (ms)
 *  - TTFB — Time to First Byte (ms)
 */
const UNITS: Record<string, 'millisecond' | 'none'> = {
  LCP: 'millisecond',
  INP: 'millisecond',
  FCP: 'millisecond',
  TTFB: 'millisecond',
  CLS: 'none',
};

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    try {
      const unit = UNITS[metric.name] ?? 'none';
      // Span-style measurement on the active page-load transaction.
      // Falls back to a breadcrumb if no scope is open (e.g. during
      // hot reload or before Sentry has booted).
      Sentry.setMeasurement(`webvital.${metric.name.toLowerCase()}`, metric.value, unit);
      Sentry.addBreadcrumb({
        category: 'web-vital',
        level:
          metric.name === 'CLS'
            ? metric.value > 0.25
              ? 'warning'
              : 'info'
            : metric.value > 4000
              ? 'warning'
              : 'info',
        message: metric.name,
        data: {
          value: Math.round(metric.value * 1000) / 1000,
          rating: metric.rating,
          id: metric.id,
          navigationType: metric.navigationType,
        },
      });
    } catch (err) {
      // Never crash a render because of metrics reporting.
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[web-vitals] report failed', err);
      }
    }
  });

  return null;
}
