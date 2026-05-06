// Re-export shim — spec §6.1 names this file `mentor-profile.ts`.
// Implementation lives in `profile.ts` for organisational cohesion.
//
// NOTE: this file is also imported from Client Components, so it must remain
// a pure re-export of server actions (which Next exposes as RPC stubs to the
// client). Read-only fetch helpers cannot live here — they would pull
// `prisma` + `server-only` into the client bundle. Use
// `./profile-queries` for read helpers.
export {
  createMentorProfile,
  updateMentorProfile,
  submitMentorForReview,
  adminApproveMentor,
  adminRejectMentor,
  addMentorSkill,
  removeMentorSkill,
} from './profile';

// Read-only fetch helper for route pages. Lives in a sibling
// `'use server'` module so importing this shim from a Client Component does
// not pull `prisma`/`server-only` into the client bundle (Next emits an RPC
// stub for server actions).
export { getMentorProfileForCurrentUser } from './profile-queries';
