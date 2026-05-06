'use server';

import { z } from 'zod';
import { type ActionResult, err, handleError, ok } from './_helpers';
import { searchCommunity as runSearch } from './discovery';

/**
 * Spec §5.2 search — public, no auth. Server-action wrapper around the pure
 * `discovery.searchCommunity` reader so the UI can call it via form-action.
 */

const schema = z.object({
  q: z.string().min(2).max(80),
  scope: z.enum(['posts', 'members', 'channels', 'all']).optional(),
});

export async function searchCommunity(
  input: z.input<typeof schema>,
): Promise<ActionResult<Awaited<ReturnType<typeof runSearch>>>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const data = await runSearch(parsed.data);
    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}
