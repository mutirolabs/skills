// An in-memory notes table answering the statements the tools issue. It
// matches SQL by shape (insert vs select, with or without a subject), so a
// new statement in a tool needs a clause here; an unmatched one throws,
// which the test sees as a failure naming the statement.
import type { MockTools } from "mutiro/test";

export type Note = { id: number; subject: string; text: string; author: string; created_at: string };

export function notesStore(seed: Partial<Note>[] = []) {
  const notes: Note[] = seed.map((n, i) => ({
    id: n.id ?? i + 1,
    subject: n.subject ?? "acme",
    text: n.text ?? "note " + (i + 1),
    author: n.author ?? "owner",
    created_at: n.created_at ?? "2026-09-0" + ((i % 9) + 1) + "T10:00:00Z",
  }));
  const tools: MockTools = {
    supabase_sql: ({ sql, params }: { sql: string; params: unknown[] }) => {
      if (sql.startsWith("insert into notes")) {
        const row: Note = { id: notes.length + 1, subject: String(params[0]), text: String(params[1]), author: String(params[2]), created_at: "2026-09-28T12:00:00Z" };
        notes.push(row);
        return { rows: [row] };
      }
      if (sql.startsWith("select") && sql.includes("where subject = $1")) {
        const rows = notes.filter((n) => n.subject === params[0]).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        return { rows: rows.slice(0, Number(params[1])) };
      }
      if (sql.startsWith("select")) {
        const rows = [...notes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        return { rows: rows.slice(0, Number(params[0])) };
      }
      throw new Error("unmatched statement: " + sql);
    },
  };
  return { notes, tools };
}

// `dev run --mocks tests/mocks.ts` reads this export. Mocks are the whole
// tool surface of a run: a hook or handler that calls one of our own
// extensions (notes_list) needs it mocked too; nothing is wired through.
const seeded = notesStore([{ subject: "acme", text: "Prefers email" }, { subject: "globex", text: "Net 30" }]);
export const tools: MockTools = {
  ...seeded.tools,
  notes_list: ({ subject, limit }: { subject?: string; limit?: number }) => {
    const rows = seeded.notes.filter((n) => !subject || n.subject === subject).slice(0, limit ?? 20);
    return { count: rows.length, notes: rows };
  },
};
