import { sql } from "./lib/store";

type Args = { subject?: string; limit?: number };

export const tool: ToolDefinition = {
  name: "notes_list",
  description: "List notes, newest first, optionally about one subject. Returns count and notes; count 0 means there are none, not that lookup failed.",
  displayName: "List Notes",
  group: "Notes",
  signalText: { en: "Reading notes", "pt-BR": "Lendo as notas" },
  inputSchema: {
    type: "object",
    properties: {
      subject: { type: "string", description: "Only notes about this subject" },
      limit: { type: "integer", description: "At most this many (default 20)" },
    },
  },
  requires: [{ kind: "connection", name: "supabase" }],
};

export const run: ToolRun<Args> = ({ args, tools }) => {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
  const rows = args.subject
    ? sql(tools, "select id, subject, text, author, created_at from notes where subject = $1 order by created_at desc limit $2", [
        args.subject.trim().toLowerCase(),
        limit,
      ])
    : sql(tools, "select id, subject, text, author, created_at from notes order by created_at desc limit $1", [limit]);
  return { count: rows.length, notes: rows };
};
