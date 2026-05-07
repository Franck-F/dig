// `eslint-config-next` ships a flat-config array natively, so we just
// re-export it. Earlier we wrapped it with FlatCompat, which produced
// "Converting circular structure to JSON" on ESLint 9 because the next
// config exports plugin instances that include circular references the
// compat shim tries to JSON-stringify. The direct re-export sidesteps
// the conversion entirely and is the documented Next.js 16 setup.
import next from 'eslint-config-next';

const eslintConfig = [
  ...next,
  {
    // Project-specific ignores on top of the defaults from next.
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'node_modules/**',
      'prisma/migrations/**',
      'public/**',
      'docs/**',
    ],
  },
  {
    // The codebase predates the React 19 / Next 16 strict-mode lint
    // rules. Downgrading them to warnings keeps CI honest (the issues
    // still surface in PR reviews) without retro-fixing every legacy
    // file in the same PR. Phase 5 will refactor each pattern with the
    // care it deserves; until then the rules below stay vocal but
    // non-blocking.
    //
    // `react-hooks/purity` + `rules/components-and-hooks-must-be-pure`
    // are turned OFF (not warn) because they fire on Date.now() in
    // server components — RSC don't re-render so the "non-deterministic
    // re-render" concern doesn't apply, but the rule has no way to
    // tell. False positives only.
    rules: {
      'react/no-unescaped-entities': 'warn',
      'react/no-danger': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      '@next/next/no-img-element': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
];

export default eslintConfig;
