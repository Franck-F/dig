// No-op replacement for the `server-only` marker package, used only by
// the test runtime. The real package throws on import to enforce the
// React Server Components boundary at build time; under `node --test`
// we don't have webpack's alias and the throw is meaningless noise.
export {};
