// Re-export shim: spec §7.3 uses `current-profile.ts`, partition instructions
// asked for `getCurrentRoleProfile.ts`. We export from both paths so route
// pages written against either convention compile.
export * from './getCurrentRoleProfile';
