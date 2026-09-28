// The one place that talks to the database. Tools import these helpers and
// never see SQL results raw: an error from the connection becomes a thrown
// Error (a failure the developer sees), an empty result an empty array.
export type Row = Record<string, any>;

export function sql(tools: Tools, statement: string, params: unknown[] = []): Row[] {
  const res = tools.supabase_sql({ sql: statement, params });
  if (res.error) throw new Error("supabase_sql: " + (res.error.message || res.error));
  return res.rows || [];
}

/** The caller as the author of a write: never trusted from model arguments. */
export const author = (context: ExtensionContext) => context.username;
