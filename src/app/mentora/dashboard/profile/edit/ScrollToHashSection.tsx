'use client';

import { useEffect } from 'react';

/**
 * The browser's native #anchor jump fires before this long server-rendered
 * settings page has laid out (and not at all after a server redirect such as
 * /mentora/dashboard/availability → …/profile/edit#disponibilites), so
 * scroll explicitly once mounted.
 */
export default function ScrollToHashSection({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [id]);
  return null;
}
