/**
 * "Votre contact Digizelle" card on the Mentorat home (Entourage Pro's
 * "Votre contact Entourage Pro"). Configured through env so the team can
 * change referent without a deploy of new copy; safe generic defaults.
 *
 * Pure, relative imports only so it runs under `node --test`.
 */

export type MentoraReferent = {
  name: string;
  role: string;
  email: string;
  photoUrl: string | null;
};

const DEFAULTS: MentoraReferent = {
  name: 'Équipe Digizelle',
  role: 'Référente Mentorat',
  email: 'contact@digizelle.fr',
  photoUrl: null,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export function getMentoraReferent(
  env: Record<string, string | undefined> = process.env,
): MentoraReferent {
  const email = clean(env.MENTORA_REFERENT_EMAIL);
  const photo = clean(env.MENTORA_REFERENT_PHOTO_URL);
  return {
    name: clean(env.MENTORA_REFERENT_NAME) ?? DEFAULTS.name,
    role: clean(env.MENTORA_REFERENT_ROLE) ?? DEFAULTS.role,
    email: email && EMAIL_RE.test(email) ? email : DEFAULTS.email,
    // https only: the URL lands in an <img src> on every member's home.
    photoUrl: photo && photo.startsWith('https://') ? photo : null,
  };
}
