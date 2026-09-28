// Scenario: the agent may draft payments but a single payment above a limit
// needs the owner's explicit approval flag. As an instruction this is a
// hope; as a beforeTool gate it is a fact, and the refusal message teaches
// the model what to do instead. The gate-only argument never reaches the
// real tool.
import { ValidationError } from "mutiro";

const LIMIT_USD = 500;

export const beforeTool: BeforeTool = ({ name, args, tools }) => {
  if (name !== "payments_send") return; // every other tool call passes untouched
  const amount = Number(args.amount_usd);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("amount_usd must be a positive number.");
  }
  if (amount > LIMIT_USD && args.approved_by_owner !== true) {
    // A read through the caller's tools is fine here: tools inside a gate
    // are the unguarded originals, so this cannot loop on itself.
    const notes = tools.notes_list({ subject: String(args.payee || ""), limit: 1 });
    const hint = notes.count ? " Latest note on this payee: " + notes.notes[0].text : "";
    throw new ValidationError(
      "Payments above " + LIMIT_USD + " USD need the owner's approval in this conversation first. Ask, then retry with approved_by_owner: true." + hint,
    );
  }
  const { approved_by_owner, ...rest } = args; // strip the gate-only flag
  return { args: rest };
};
