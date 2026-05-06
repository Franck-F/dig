// Re-export shim — spec §6.2 names this file `mentee-profile.ts`.
//
// NOTE: keep this file as a pure re-export shim (no `server-only` import) so
// the client wizard can `import` the server actions from here without Next
// flagging the file as a server-only module loaded into a Client Component.
// The read-only fetch helper lives in `./profile-queries`.
export {
  updateMenteeProfile as upsertMenteeProfile,
  updateMenteeProfile,
  addMenteeGoalSkill,
  removeMenteeGoalSkill,
} from './profile';

export { getMenteeProfileForCurrentUser } from './profile-queries';
