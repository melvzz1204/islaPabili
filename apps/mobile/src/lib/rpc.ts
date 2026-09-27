/**
 * Call a Postgres RPC by name.
 *
 * The generated client overloads recurse under TS 6, so this goes through an
 * untyped signature — but it MUST keep the client as receiver (`.call`),
 * because supabase-js reads internal state (`this.rest`) when executing.
 * Detaching the method (`const rpc = client.rpc; rpc(…)`) crashes at runtime.
 */
export async function callRpc<T>(client: { rpc: unknown }, fn: string, args: Record<string, string>) {
  const rpc = client.rpc as (
    this: unknown,
    fn: string,
    args: Record<string, string>,
  ) => Promise<{ data: T | null; error: { message: string } | null }>;
  return rpc.call(client, fn, args);
}
