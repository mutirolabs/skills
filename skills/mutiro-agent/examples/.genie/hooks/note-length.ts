// Keep notes compact: trim outer whitespace and refuse text over 280
// Unicode code points. Refuse rather than silently truncating facts.
import { ValidationError } from "mutiro";

export const beforeTool: BeforeTool = ({ name, args }) => {
  if (name !== "notes_add") return;
  if (typeof args.text !== "string" || !args.text.trim()) {
    throw new ValidationError("text must be a non-empty string.");
  }
  const text = args.text.trim();
  if (Array.from(text).length > 280) {
    throw new ValidationError("Notes must be at most 280 characters. Condense the note without dropping facts, or split distinct facts into separate notes.");
  }
  return { args: { ...args, text } };
};
