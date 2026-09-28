// Scenario: three things should never cost a model turn. A health check
// from monitoring gets a fixed reply; the agent's own forwarded copies are
// skipped; a page's cheap action is answered here. Anything else passes
// to the model unchanged.
import { Handoff } from "mutiro";

export const onMessage: OnMessage = ({ payload, tools }) => {
  if (payload.text.trim() === "/ping") {
    return { reply: "pong " + new Date().toISOString() };
  }
  if (payload.metadata && payload.metadata.forwarded_by_agent === "true") {
    return { skip: true, reason: "own forwarded copy" };
  }
  if (payload.action && payload.action.name === "countNotes") {
    // A page action can be answered without a turn when it is a plain read.
    const res = tools.notes_list({ subject: String(payload.action.payload.subject || ""), limit: 100 });
    return { result: { count: res.count } };
  }
  if (payload.action && payload.action.name === "summarizeNotes") {
    // Judgement needed: hand it to the model on purpose, with the reason in front of it.
    throw new Handoff("summaries need the model; the hook only counts");
  }
  return; // a normal turn
};
