// The page's one action: notes grouped by subject. Deterministic, so it is a
// function and never a turn. Runs with the viewer's tools: a user sees what
// notes_list returns for a user.
import { ValidationError } from "mutiro";

type Payload = { limit?: number };
type Note = { subject: string; text: string; created_at: string };

export const loadStatus: Handler<Payload> = ({ payload, tools }) => {
  const limit = Math.min(Math.max(payload.limit ?? 50, 1), 200);
  const res = tools.notes_list({ limit });
  if (res.error) throw new ValidationError("Notes could not be read: " + (res.error.message || res.error));
  const bySubject = new Map<string, { count: number; last: string }>();
  for (const n of res.notes as Note[]) {
    const cur = bySubject.get(n.subject) || { count: 0, last: "" };
    cur.count += 1;
    if (n.created_at > cur.last) cur.last = n.created_at;
    bySubject.set(n.subject, cur);
  }
  const subjects = Array.from(bySubject, ([subject, v]) => ({ subject, count: v.count, last: v.last.slice(0, 10) }));
  subjects.sort((a, b) => (a.last < b.last ? 1 : -1));
  return { subjects, updated_at: new Date().toISOString() };
};
