import { redirect } from 'next/navigation';

/**
 * Legacy alias — the connected community now lives at `/community` and is
 * auth-aware via `community/layout.tsx`. We keep this redirect so old
 * bookmarks and any internal links don't 404.
 */
export default function AppCommunityAlias() {
  redirect('/community');
}
