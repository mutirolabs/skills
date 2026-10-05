# Budgets: what an agent spends, and how to control it

Every model turn, web search, image, voice message and decision a hosted
agent makes is paid work, and it is paid from the owner's plan.
This file explains how that money is counted, how to keep one agent from
spending what the others need, and how to design an agent that does the
same job with fewer paid calls: first the switches any owner can flip,
then the design moves that remove whole turns.

## One budget, shared by the owner's agents

The plan belongs to the owner, not to an agent. It includes a monthly
spend budget (in dollars, reset on the 1st, UTC) that **all of the
owner's agents draw from**, together with the plan's counted limits
(agents, people per agent, schedules, webhooks: `runtime.md`, Limits).

```bash
mutiro user usage            # every limit, today's and this month's spend by source and by agent
mutiro user usage --json
```

Spend is shown by **source** (`llm.call`, `web.search`,
`image.generation`, `audio.transcription`, ...) and by **agent**, so the
first question, "which agent, doing what", is answered without a trace.

When the month's budget is spent, Mutiro refuses paid calls until it
resets: the call fails with a plan-limit error that names the limit and
the reset date, and the provider is never called. A refused model call
means the agent cannot answer. Daily figures are shown for pacing; the month is what
refuses.

### Agent spend limits: one agent cannot starve the rest

Because the budget is shared, one busy agent (a long conversation, a
runaway schedule, an abused webhook) can spend the month and stop every
other agent the owner runs. A **spend limit** caps what one agent may
spend of the plan each month:

```bash
mutiro agents spend-limit <agent> 20     # this agent may spend $20 a month of your plan
mutiro agents spend-limit <agent> off    # back to the plan's limit only
```

- The agent is refused at its own limit or at the plan's, whichever comes
  first. The other agents keep going.
- A limit is a ceiling, not money set aside: limits may add up to more
  than the plan. To guarantee each agent its share, set limits that add up
  to no more than the plan's monthly budget.
- A limit cannot exceed the plan's monthly budget. Only the owner sets
  it: not a developer, not the agent.
- `mutiro user usage` lists each limited agent's spend against its limit.

Set a limit on any agent that faces people you do not control, runs on a
schedule or a webhook, or does open-ended work (research, long documents).
Leave the plan's headroom for the agents that matter most.

## What is paid, and who pays it

| Source | What triggers it |
|---|---|
| Model turns | every turn the agent takes: messages, page actions without a handler, scheduled messages, webhook deliveries |
| Web search | `web_search` (`web_fetch` is not a paid call) |
| Images | `send_image_message`, `edit_image_message` |
| Voice out | `send_voice_message` (priced by characters spoken) |
| Voice in | voice notes people send are transcribed before the turn (priced by seconds), and `get_audio_transcript`; a transcript is made once and reused |
| Decisions | `decide`, from the model or from your code (priced by input tokens, nothing for the answer) |

**Who pays.** Paid work in an agent's conversation is charged to the
agent, whoever triggered it: a user's voice note, the summary of a
user's long thread, the search a user asked for all count toward that
agent's limit and its owner's plan. Sharing an agent is sharing your
budget: every person on the allowlist (`runtime.md`, Who may talk to it)
can spend it.

**What is not charged to the plan:**

- Message search. `message_search` covers the conversation's messages
  from the last 30, 90 or 180 days depending on the plan; it is part of
  the plan, not paid from its budget, and never refused for spend.
- Connections that run on your own account, like the Browser Use
  browser (`connections.md`).
- A self-hosted agent's model calls. The Mutiro
  services it uses (web search, images, voice, decisions) are still
  paid from the plan.

## The switches any owner has

Before any design work, remove the paid capabilities the agent does not
need. Each is a control-plane switch (`runtime.md`, Tool surface), takes
effect at the next wake, and can be reversed.

```bash
mutiro agents tools list <agent>
mutiro agents tools disable <agent> send_voice_message send_image_message edit_image_message web_search
mutiro agents tools enable <agent> web_search --owner-only    # you can still use it; your users cannot
```

- **Off** when the agent's job never needs it: an accounting assistant
  does not draw images or speak.
- **Owner-only** when it is a tool for you, not for the people the agent
  serves. Users then cannot spend your budget on it.
- **Fewer people, fewer turns.** Every person on the allowlist is a source
  of turns; share deliberately.
- **Schedules** cost a turn every time they fire. Run them as rarely as
  the work allows (daily, not hourly), and pause what nobody reads:
  `mutiro agents schedule pause <schedule-id>`.
- **Webhooks** cost a turn per delivery. Filter at the source so only
  events the agent acts on are sent; pause a noisy one with
  `mutiro agents webhook pause <webhook-id>`.

## Context is the largest lever

A model turn is priced by what the model reads, and it reads the whole
context every turn: the soul, the manual, the conversation so far, every
tool result in it. The same question costs many times more on the
hundredth turn of a thread than on the first. A single long conversation
is the usual reason one agent dominates the bill.

- **Clear stale conversations.** `mutiro user conversation clear <agent>`
  (yours) or `mutiro agent conversation clear <agent> <user>` (a user's)
  starts the context over; memory and workspace files stay. A scheduled
  message whose first line is `/clear` starts each run from a clean
  context, which suits a daily job that needs nothing from yesterday's
  turn.
- **Keep the always-loaded files short.** `.genie/AGENTS.md` and the soul
  are in every turn; a skill costs only its name and description until it
  is used. Procedures, templates and reference tables belong in skills
  (`instructions.md`).
- **Return less from tools.** List tools return summary rows and leave
  detail to a get tool (`extensions.md`, Design rules). A tool result
  stays in the context for the rest of the thread, so a 30 KB listing is
  paid again on every later turn.
- **Read files in parts.** A document the agent reads whole on every
  question costs the whole document every time; a tool that returns the
  section asked for costs the section.

## Doing the work without a turn

The cheapest turn is the one that never runs. Three extension points
(`extensions.md`) answer requests in code, and `decide` gives that code
the judgment it would otherwise need the model for.

### Settle messages in a hook

`onMessage` runs before every turn, for messages from people, page
actions, scheduled messages and webhook deliveries alike. Returning
`{ skip: true }` drops the message and `{ reply }` answers it; either way
no model turn runs. A webhook delivery carries `metadata["mutiro.webhook_id"]`,
a scheduled message `metadata["mutiro.scheduled_message_id"]`.

- **Drop noise.** Auto-replies, newsletters, delivery receipts, a webhook
  event type the agent does not act on.
- **Answer the routine in code.** A status question, an acknowledgement,
  a lookup that is one tool call and a template.
- **Make schedules conditional.** A scheduled check runs its tool in the
  hook and skips when nothing changed; the turn runs only when there is
  something to say.

The hook runs as the sender (`role` is `user` for people and service
senders alike), so it holds the sender's tools: an extension it calls must
not be `owner_only`. Transcription happens before the hook, so skipping a
voice note does not avoid it.

### Answer pages in handlers

A page's `mutiro.request(action, ...)` becomes a turn unless the
`handlers.ts` beside it exports that action. A dashboard that refreshes
through turns pays for a model call per refresh; with a handler it pays
for the tool calls only. Grow handlers for the routine actions and keep
the turn for what needs judgment (`extensions.md`, Page handlers).

### Put the steps in one tool

Each tool call the model makes is a round trip in which it reads the whole
context again. A procedure of five lookups and a write, run by the model,
is six round trips; the same procedure in one tool extension is one. When
a process is deterministic, write it as a verb (`extensions.md`), and let
the model call the verb.

### Use `decide` for judgment in code

Code stops at the first judgment the data does not state: what kind of
message this is, whether a reply is needed, which customer this is about.
Without `decide`, that judgment is a model turn, and usually several (read
the message, look things up, classify, then act). `decide` answers typed
questions in one call, priced by input tokens with nothing for the answer,
at a small fraction of a model turn; it is available to hooks, extensions,
handlers and the model.

The pattern: **classify and gather in code, then hand the model one turn
with the facts, or no turn at all.** An inbox agent receives emails that
are either a quote request, a quote confirmation or something else, each
with its own procedure:

```ts
import { Handoff } from "mutiro";

const KIND = {
  type: "choice",
  instructions: "What is this email?",
  criteria: {
    quote_request: "asks for a price or a quote",
    quote_confirmation: "accepts or confirms a quote we sent",
    noise: "auto-reply, newsletter, delivery notice",
    other: "anything else",
  },
};

// An inbound email arrives as a webhook delivery from the email connection;
// the email itself (From, Subject, body) is the message's note part.
const emailOf = (payload) =>
  payload.parts.filter((p) => p.type === "note").map((p) => p.text).join("\n");

export const onMessage: OnMessage = ({ payload, tools }) => {
  if (payload.metadata?.["mutiro.webhook_source"] !== "agentmail") return;
  const email = emailOf(payload);
  const r = tools.decide({ state: email.slice(0, 4000), questions: { kind: KIND } });
  if (r.error) return; // no judgment: the turn handles it as usual
  const kind = r.answers.kind.choice;
  if (kind === "noise") return { skip: true, reason: "noise" };

  const from = (email.match(/^From: (.+)$/m) || [])[1] || "";
  const customer = tools.customers_find({ email: from }); // your extension
  const known = customer.error ? "unknown sender" : "customer " + customer.id + " (" + customer.name + ")";
  throw new Handoff("email: " + kind + "; " + known + ". Follow the " + kind + " procedure.");
};
```

The noise never reaches the model. The rest arrives as one turn that
already knows the kind and the customer, so the model starts at the
procedure instead of spending turns finding out where it is. The same
shape fits a webhook (classify the event, drop what needs no action) and
a page action (decide whether a submission is complete before a turn
looks at it).

Keep the `state` to what the questions need: it is what you pay for. Ask
several questions in one call rather than one call per question. Check
`r.error` and fall back to the turn, never to a guess. Verify thresholds
with evals before letting a `decide` answer drop or settle messages
(`extensions.md`, Judgment in code).

### Gate expensive calls

A `beforeTool` hook can refuse a paid call by rule: a cap on images per
person per day kept in your store, web search only for the owner after a
point, a voice reply only when the person wrote by voice. The refusal
message tells the model what to do instead, so the turn still ends well.

## Measuring before tuning

Tune the largest bucket first, and measure it before and after:

1. `mutiro user usage`: which agent and which source.
2. For model spend, which conversations: long threads and frequent
   schedules dominate. Supervision reads (`tuning.md`) show the thread; the
   activity digest per message shows how many tool round trips each reply
   took.
3. Change one thing (a switch, a clear, a hook), then read the same
   figures the next day. A hook that drops or settles messages gets an
   eval (`evals.md`) that proves it still lets the real requests through.
