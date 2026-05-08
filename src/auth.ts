import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Discord from 'next-auth/providers/discord';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/auth.config';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

/**
 * Build the provider list. OAuth providers are appended only when both env
 * vars are present so the login page can degrade gracefully — the UI reads
 * `oauthEnabled` (computed from the same env vars) to disable the buttons
 * the runtime can't service.
 */
const providers: Provider[] = [
  Credentials({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Mot de passe', type: 'password' },
    },
    async authorize(creds) {
      const parsed = credentialsSchema.safeParse(creds);
      if (!parsed.success) return null;

      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (!user || !user.passwordHash) return null;
      // Soft-deleted accounts are tombstones — the email has been
      // anonymised, but we double-check defensively so a partially-rolled
      // delete still can't authenticate.
      if (user.deletedAt) return null;

      const ok = await compare(parsed.data.password, user.passwordHash);
      if (!ok) return null;

      // Hard gate: unverified credentials accounts cannot sign in.
      // The UI's signIn action also short-circuits before calling NextAuth,
      // but this protects direct callers of the credentials provider.
      if (!user.emailVerified) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name ?? ([user.firstName, user.lastName].filter(Boolean).join(' ') || null),
        image: user.image,
      };
    },
  }),
];

// `allowDangerousEmailAccountLinking` auto-links an OAuth account to an
// existing user when their verified email matches. Auth.js flags this
// "dangerous" because if a provider returns unverified emails, an attacker
// could take over an account by creating an OAuth account with the
// victim's email. Google, GitHub and Discord all verify the email before
// returning it, so the risk is bounded — and the alternative (the
// OAuthAccountNotLinked error users hit when they previously signed up
// with credentials) is a worse trade-off for our threat model.
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}
if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET) {
  providers.push(
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

/**
 * Helper exposed to the page-level so OAuth buttons can be disabled when the
 * provider isn't configured. Read at module load — env is stable per runtime.
 */
export const oauthEnabled = {
  google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  github: !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  discord: !!(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET),
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  events: {
    /**
     * On first OAuth sign-in, stamp `emailVerified` so future credential
     * gates and downstream logic that key off this flag work uniformly.
     * The provider has already vouched for the email, so we trust it.
     *
     * Also flip `roleConfirmed` to false: the schema default for
     * `User.role` is `STUDENT`, but for OAuth signups the user never had
     * the chance to pick. The /welcome/role gate (checked from /app and
     * /mentora/onboarding) sends them through a one-time chooser before
     * they enter the app proper.
     */
    async signIn({ user, account, isNewUser }) {
      if (!user?.id || !account || account.provider === 'credentials') return;
      if (isNewUser) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date(), roleConfirmed: false },
        });
      }
    },
  },
});
