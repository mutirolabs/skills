import { describe, it, expect, tool } from "mutiro/test";
import { notesStore } from "./mocks";

describe("notes_add", () => {
  it("stores a trimmed, lower-cased subject with the caller as author", () => {
    const store = notesStore();
    const r = tool("notes_add").run({ subject: "  ACME ", text: "Prefers email." }, { tools: store.tools, context: { username: "ana" } });
    expect(r.kind).toBe("result");
    expect(r.result.note).toMatchObject({ subject: "acme", text: "Prefers email.", author: "ana" });
    expect(store.notes).toHaveLength(1);
    expect(r.calls.map((c) => c.tool)).toEqual(["supabase_sql"]);
  });
  it("refuses an empty subject or text and writes nothing", () => {
    const store = notesStore();
    expect(tool("notes_add").run({ subject: "  ", text: "x y z" }, { tools: store.tools }).validation).toContain("subject is empty");
    expect(tool("notes_add").run({ subject: "acme", text: " " }, { tools: store.tools }).validation).toContain("text is empty");
    expect(store.notes).toHaveLength(0);
  });
  it("surfaces a connection error as a failure, not a result", () => {
    const r = tool("notes_add").run({ subject: "acme", text: "hello" }, { tools: { supabase_sql: () => ({ error: { message: "relation notes does not exist" } }) } });
    expect(r.kind).toBe("failure");
    expect(r.failure).toContain("relation notes does not exist");
  });
});

describe("notes_list", () => {
  it("lists newest first, filtered by subject, clamped to the limit", () => {
    const store = notesStore([{ subject: "acme", text: "a1" }, { subject: "globex", text: "g1" }, { subject: "acme", text: "a2" }]);
    const all = tool("notes_list").run({}, { tools: store.tools });
    expect(all.result.count).toBe(3);
    expect(all.result.notes[0].text).toBe("a2");
    const acme = tool("notes_list").run({ subject: "ACME", limit: 1 }, { tools: store.tools });
    expect(acme.result.notes.map((n: any) => n.text)).toEqual(["a2"]);
    expect(acme.calls[0].args).toMatchObject({ params: ["acme", 1] });
  });
  it("returns count 0 for an unknown subject", () => {
    expect(tool("notes_list").run({ subject: "nobody" }, { tools: notesStore().tools }).result).toEqual({ count: 0, notes: [] });
  });
});
