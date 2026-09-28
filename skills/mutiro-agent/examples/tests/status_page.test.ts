import { describe, it, expect, handler } from "mutiro/test";

const notes = [
  { subject: "acme", text: "a1", created_at: "2026-09-01T10:00:00Z" },
  { subject: "globex", text: "g1", created_at: "2026-09-20T10:00:00Z" },
  { subject: "acme", text: "a2", created_at: "2026-09-10T10:00:00Z" },
];

describe("status page: loadStatus", () => {
  it("groups notes by subject, newest subject first, and clamps the limit", () => {
    const r = handler("shared/status", "loadStatus").run({ limit: 5000 }, { tools: { notes_list: ({ limit }: { limit: number }) => ({ count: notes.length, notes, limit }) } });
    expect(r.kind).toBe("result");
    expect(r.result.subjects).toEqual([
      { subject: "globex", count: 1, last: "2026-09-20" },
      { subject: "acme", count: 2, last: "2026-09-10" },
    ]);
    expect(r.calls[0].args).toEqual({ limit: 200 });
    expect(r.result.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it("turns a tool error into the page's error", () => {
    const r = handler("shared/status", "loadStatus").run({}, { tools: { notes_list: () => ({ error: { message: "connection refused" } }) } });
    expect(r.validation).toContain("connection refused");
  });
});
