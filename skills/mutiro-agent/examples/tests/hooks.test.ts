import { describe, it, expect, hook } from "mutiro/test";

const notes = (count: number) => ({ notes_list: () => ({ count, notes: count ? [{ text: "Pays late" }] : [] }) });

describe("note-length (beforeTool)", () => {
  it("ignores every other tool", () => {
    expect(hook("beforeTool").run({ text: "x".repeat(281) }, { call: "notes_list" }).kind).toBe("allowed");
  });
  it("trims a note and preserves its subject", () => {
    const r = hook("beforeTool").run({ subject: "acme", text: "  Prefers email  " }, { call: "notes_add" });
    expect(r.kind).toBe("allowed");
    expect(r.args).toEqual({ subject: "acme", text: "Prefers email" });
  });
  it("refuses an oversized note rather than truncating it", () => {
    const r = hook("beforeTool").run({ subject: "acme", text: "x".repeat(281) }, { call: "notes_add" });
    expect(r.kind).toBe("refused");
    expect(r.refusal).toContain("at most 280 characters");
  });
  it("accepts the exact limit after trimming", () => {
    const text = "x".repeat(280);
    const r = hook("beforeTool").run({ subject: "acme", text: " " + text + " " }, { call: "notes_add" });
    expect(r.kind).toBe("allowed");
    expect(r.args?.text).toBe(text);
  });
  it("counts Unicode code points rather than UTF-16 code units", () => {
    expect(hook("beforeTool").run({ text: "😀".repeat(280) }, { call: "notes_add" }).kind).toBe("allowed");
    expect(hook("beforeTool").run({ text: "😀".repeat(281) }, { call: "notes_add" }).kind).toBe("refused");
  });
  it("refuses missing, non-string and blank text", () => {
    for (const text of [undefined, 123, "   "]) {
      expect(hook("beforeTool").run({ text }, { call: "notes_add" }).refusal).toContain("non-empty string");
    }
  });
});

describe("triage (onMessage)", () => {
  it("answers /ping without a turn", () => {
    const r = hook("onMessage").run({ text: "/ping", from: "monitor" });
    expect(r.kind).toBe("reply");
    expect(String(r.reply)).toMatch(/^pong \d{4}-/);
  });
  it("skips the agent's own forwarded copies", () => {
    const r = hook("onMessage").run({ text: "fwd", from: "me", metadata: { forwarded_by_agent: "true" } });
    expect(r.kind).toBe("skip");
    expect(r.reason).toBe("own forwarded copy");
  });
  it("answers a page's countNotes action from the store", () => {
    const r = hook("onMessage").run({ text: "", action: { name: "countNotes", payload: { subject: "acme" }, page: "status/index.html" } }, { tools: notes(3) });
    expect(r.kind).toBe("result");
    expect(r.result).toEqual({ count: 3 });
  });
  it("hands summarizeNotes to the model on purpose", () => {
    const r = hook("onMessage").run({ text: "", action: { name: "summarizeNotes", payload: {}, page: "status/index.html" } });
    expect(r.kind).toBe("handoff");
    expect(r.handoff).toContain("need the model");
  });
  it("passes an ordinary message through", () => {
    expect(hook("onMessage").run({ text: "hello there", from: "ana" }).kind).toBe("pass");
  });
});

describe("redact (beforeReply)", () => {
  it("masks tokens and card-like numbers", () => {
    const r = hook("beforeReply").run({ text: "key sk_live_abcdefghijklmnop and card 4111 1111 1111 1111 ok" });
    expect(r.kind).toBe("text");
    expect(r.text).toBe("key [redacted token] and card [redacted number] ok");
  });
  it("leaves a clean reply untouched", () => {
    expect(hook("beforeReply").run({ text: "Order 12345 ships on 2026-09-30." }).kind).toBe("pass");
  });
});
