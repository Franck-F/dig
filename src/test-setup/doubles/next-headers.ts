// Double of `next/headers`: no incoming request in integration tests.
export async function headers(): Promise<Headers> {
  return new Headers();
}

export async function cookies(): Promise<{ get: (name: string) => undefined; set: () => void; delete: () => void }> {
  return { get: () => undefined, set: () => {}, delete: () => {} };
}
