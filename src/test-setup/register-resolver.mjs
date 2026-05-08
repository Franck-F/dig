// ESM resolver hook for `node --test --experimental-strip-types`.
//
// Three jobs:
//  1. `server-only` → no-op shim. The real npm package throws on
//     import to enforce the RSC boundary at build time; under
//     `node --test` we don't have webpack's alias and the throw is
//     meaningless noise.
//  2. `@/foo` → `<repo>/src/foo`. Mirrors the tsconfig `paths`
//     alias so production source can use it freely.
//  3. Bare relative `./foo` / `../foo` (no extension) → append `.ts`
//     when a `.ts` file exists. Production source uses extension-less
//     imports (Next/Webpack/TS bundler resolution); strict Node ESM
//     requires explicit extensions.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const REPO_ROOT = pathToFileURL(pathResolve(fileURLToPath(import.meta.url), '../../../') + '/').href;
const SRC_ROOT = REPO_ROOT + 'src/';

export function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return {
      url: new URL('./server-only-shim.mjs', import.meta.url).href,
      format: 'module',
      shortCircuit: true,
    };
  }

  // `@/...` → `<repo>/src/...`. Re-resolve with the rewritten spec
  // so the extension-append logic below also applies.
  if (specifier.startsWith('@/')) {
    const rewritten = SRC_ROOT + specifier.slice(2);
    return resolve(rewritten, context, nextResolve);
  }

  // Append `.ts` to relative imports when the candidate file exists.
  // We don't blanket-add `.ts` because some existing tests already
  // pass it explicitly.
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
  const isAbsoluteFileUrl = specifier.startsWith('file://');
  if ((isRelative || isAbsoluteFileUrl) && !/\.[a-z]+$/i.test(specifier)) {
    try {
      const baseUrl = isAbsoluteFileUrl
        ? new URL(specifier)
        : context.parentURL
          ? new URL(specifier, context.parentURL)
          : null;
      if (baseUrl) {
        const candidates = [baseUrl.href + '.ts', baseUrl.href + '.tsx', baseUrl.href + '/index.ts'];
        for (const c of candidates) {
          const p = fileURLToPath(c);
          if (existsSync(p)) {
            return nextResolve(c, context);
          }
        }
      }
    } catch {
      // fall through to nextResolve
    }
  }

  return nextResolve(specifier, context);
}
