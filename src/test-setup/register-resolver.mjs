// ESM resolver hook that intercepts the `server-only` import and
// rewrites it to a local no-op shim. The real npm package throws on
// import to enforce the React Server Components boundary at build
// time; under `node --test` we don't have webpack's alias and the
// throw is meaningless noise. Using our own shim (rather than the
// package's `empty.js`) avoids fighting the package's `exports`
// field which doesn't expose the empty file under the `default`
// condition.
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return {
      url: new URL('./server-only-shim.mjs', import.meta.url).href,
      format: 'module',
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
