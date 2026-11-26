// Double of `next/server` for route handlers called directly in tests.
export const NextResponse = {
  json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
};
