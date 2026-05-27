# E2E tests

Playwright suite covering critical public flows (smoke, auth scaffolding, mentora discovery). Runs against a live deployment via `E2E_BASE_URL`.

## Run

```bash
# default target: https://dig-black.vercel.app
npm run test:e2e

# against a Vercel preview
E2E_BASE_URL=https://dig-git-<branch>-<owner>.vercel.app npm run test:e2e

# against local `next start`
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## What's covered

| Spec | What it asserts |
| --- | --- |
| `smoke.spec.ts` | 11 public paths return < 500, have a non-empty `<title>`, and don't log console errors. Cookie banner appears on first visit. |
| `auth.spec.ts` | `/login` renders email + password fields + an OAuth button, shows validation on empty submit. `/contact` renders the form. |
| `mentora-discovery.spec.ts` | `/mentora` advertises mentorship + the body contains mentor cards. |

## What's NOT covered (deliberate)

- Anything that writes to the DB — there's no test DB on the target.
- Authenticated dashboard flows — requires a seeded test account + email-step bypass.
- The video-recording suite under `demo/` is a separate harness (different config, different output).

## Adding tests

- Keep each spec readable from top to bottom. No shared module helpers across specs unless duplication actually starts hurting.
- Don't click `button[type="submit"]` unless the test is opted in to writing — assert the form's _appearance_ instead.
- Filter expected console noise (Sentry init, hydration warnings on streamed responses) — every flake erodes the suite's signal.
