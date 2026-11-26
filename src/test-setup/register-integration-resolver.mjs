// Integration-test resolver hook: swaps the modules that need a Next.js
// request (auth session, cache revalidation, headers, 2FA cookie) or a network
// (Sentry) for in-process doubles under src/test-setup/doubles. Registered
// after register-loader.mjs, so it runs first in the hook chain.
const DOUBLES = {
  '@/auth': 'auth.ts',
  'next/cache': 'next-cache.ts',
  'next/headers': 'next-headers.ts',
  'next/server': 'next-server.ts',
  '@/lib/auth/admin-2fa-cookie': 'admin-2fa-cookie.ts',
  '@sentry/nextjs': 'sentry.ts',
};

export function resolve(specifier, context, nextResolve) {
  const file = DOUBLES[specifier];
  if (file) return { url: new URL(`./doubles/${file}`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
}

// Next's bundler loads `import('…/messages/fr.json')` without an import
// attribute; plain Node ESM requires `with { type: 'json' }`. Serve JSON
// files as ES modules so the code under test loads its messages unchanged.
export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.json')) {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL(url), 'utf8');
    return { format: 'module', source: `export default ${source};`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
