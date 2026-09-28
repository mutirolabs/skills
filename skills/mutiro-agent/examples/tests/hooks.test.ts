import { describe, it, expect, hook } from "mutiro/test";

const notes = (count: number) => ({ notes_list: () => ({ count, notes: count ? [{ text: "Pays late" }] : [] }) });

describe("spend-gate (beforeTool)", () => {
  it("ignores every other tool", () => {
    expect(hook("beforeTool").run({ amount_usd: 9999 }, { call: "notes_add" }).kind).toBe("allowed");
  });
  it("lets a small payment through and strips the approval flag", () => {
    const r = hook("beforeTool").run({ payee: "acme", amount_usd: 120, approved_by_owner: false }, { call: "payments_send" });
    expect(r.kind).toBe("allowed");
    expect(r.args).toEqual({ payee: "acme", amount_usd: 120 });
  });
  it("refuses a large unapproved payment and quotes the payee's latest note", () => {
    const r = hook("beforeTool").run({ payee: "acme", amount_usd: 800 }, { call: "payments_send", tools: notes(1) });
    expect(r.kind).toBe("refused");
    expect(r.refusal).toContain("need the owner's approval");
    expect(r.refusal).toContain("Pays late");
    expect(r.calls.map((c) => c.tool)).toEqual(["notes_list"]);
  });
  it("lets an approved large payment through", () => {
    const r = hook("beforeTool").run({ payee: "acme", amount_usd: 800, approved_by_owner: true }, { call: "payments_send", tools: notes(0) });
    expect(r.kind).toBe("allowed");
    expect(r.args).toEqual({ payee: "acme", amount_usd: 800 });
    expect(r.calls).toHaveLength(0);
  });
  it("refuses a malformed amount", () => {
    expect(hook("beforeTool").run({ amount_usd: "lots" }, { call: "payments_send" }).refusal).toContain("positive number");
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
