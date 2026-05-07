// Test-only ESM loader hook. Registers a virtual `server-only` module
// that resolves to `server-only/empty.js`, which is the no-op variant
// the package ships for webpack's server alias. Without this, importing
// any module that does `import 'server-only'` throws under plain Node.
//
// Usage: `node --import ./src/test-setup/register-loader.mjs --test ...`
import { register } from 'node:module';

// Resolve the resolver hook against this file's URL. Don't pass a raw
// path string — on Windows the parentURL gets mangled into
// `C:\…\file:\C:\…` because `pathToFileURL` ends up doubling the
// drive prefix.
register(new URL('./register-resolver.mjs', import.meta.url));
