import { ValidationError } from "mutiro";
import { sql, author } from "./lib/store";

type Args = { subject: string; text: string };

export const tool: ToolDefinition = {
  name: "notes_add",
  description:
    "Record a note about a subject (a customer id, an order number). Returns the stored note. Use notes_list to read them back; never keep notes in memory instead.",
  displayName: "Add Note",
  group: "Notes",
  signalText: { en: "Saving a note", "pt-BR": "Salvando uma nota" },
  inputSchema: {
    type: "object",
    properties: {
      subject: { type: "string", description: "What the note is about, e.g. a customer id" },
      text: { type: "string", description: "The note, one to three sentences" },
    },
    required: ["subject", "text"],
  },
  requires: [{ kind: "connection", name: "supabase" }],
};

export const run: ToolRun<Args> = ({ args, tools, context }) => {
  const subject = args.subject.trim().toLowerCase();
  if (!subject) throw new ValidationError("subject is empty: name what the note is about.");
  if (args.text.trim().length < 3) throw new ValidationError("text is empty: write the note.");
  const rows = sql(tools, "insert into notes (subject, text, author) values ($1, $2, $3) returning id, subject, text, author, created_at", [
    subject,
    args.text.trim(),
    author(context),
  ]);
  return { note: rows[0] };
};
