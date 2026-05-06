// Re-export shim: spec §6.8 calls this file `discover.ts`; partition
// instructions used `discovery.ts`. Both names compile.
export * from './discovery';
// Spec §6.8 uses `searchMentors`; expose alias.
export { discoverMentors as searchMentors } from './discovery';
