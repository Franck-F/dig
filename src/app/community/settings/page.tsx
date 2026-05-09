import { permanentRedirect } from 'next/navigation';

/**
 * Settings moved to /account/settings — Mentora and Community are
 * independent products and the old URL implied a Community-only scope
 * that no longer reflects reality. Permanent redirect so any bookmarks,
 * email links, or share-card URLs route to the new home.
 */
export default function CommunitySettingsRedirect() {
  permanentRedirect('/account/settings');
}
