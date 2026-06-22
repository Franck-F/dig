import 'server-only';
import { createHash } from 'node:crypto';

/**
 * Have I Been Pwned "range" check via k-anonymity: we SHA-1 the password and
 * send ONLY the first 5 hex chars to the API, which returns every breached
 * suffix sharing that prefix; we match the rest locally. The plaintext (and
 * even its full hash) never leaves the server.
 *
 * Fail-OPEN: any network/HTTP error returns false (not breached) so a
 * third-party outage can't block legitimate signups — the length/identity
 * policy still applies. `Add-Padding` asks HIBP to pad the response so the
 * number of matches can't be inferred from its size.
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      cache: 'no-store',
    });
    if (!res.ok) return false; // fail-open

    const body = await res.text();
    for (const line of body.split('\n')) {
      const sep = line.indexOf(':');
      if (sep === -1) continue;
      const lineSuffix = line.slice(0, sep).trim().toUpperCase();
      const count = Number(line.slice(sep + 1));
      // Padded entries are returned with count 0 — ignore them.
      if (count > 0 && lineSuffix === suffix) return true;
    }
    return false;
  } catch {
    return false; // fail-open on network error
  }
}
