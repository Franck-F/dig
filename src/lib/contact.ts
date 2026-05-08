/**
 * Centralised contact addresses for the app. Read lazily from env so a
 * single deployment-time value drives every surface (RGPD copy, 2FA
 * lockout notice, account-deletion banners, newsletter footer, …).
 *
 * Why a helper rather than `process.env.X` at every call site:
 *  - One source of truth — flipping the address in `.env` updates
 *    13+ surfaces in lockstep.
 *  - Sane defaults — a missing env var falls back to the historical
 *    hardcoded value so dev environments keep working.
 *  - Lazy reads — Next.js App Router renders RSCs in pre-render and
 *    runtime contexts; reading `process.env` at module-load time can
 *    bake the wrong value into the build cache.
 *
 * Two distinct addresses, deliberately separate:
 *  - DPO: RGPD / data-protection / 2FA-recovery-of-last-resort.
 *    Should be a privacy-trained mailbox; legally required by Art. 30.
 *  - Contact: general support / press / partnerships. May or may not
 *    be the same mailbox as DPO depending on the org's size.
 */

/**
 * RGPD / privacy contact. Override via `DPO_EMAIL`. Falls back to the
 * single canonical Digizelle inbox `contact@digizelle.fr` — the
 * association operates with one functional address; legal copy and
 * UI surfaces all collapse to this single point of contact unless an
 * env override designates a dedicated DPO mailbox.
 */
export function getDpoEmail(): string {
  return process.env.DPO_EMAIL || 'contact@digizelle.fr';
}

/**
 * General contact / support address. Override via `CONTACT_TO_EMAIL`
 * (also used by `mentora/notifications.ts` and the contact-form
 * forwarder, so the env var name pre-dates this helper).
 */
export function getContactEmail(): string {
  return process.env.CONTACT_TO_EMAIL || 'contact@digizelle.fr';
}
