# Extension points: tools, hooks, page handlers

Three kinds of owner-authored code run inside the agent's runtime. All are
TypeScript (or JavaScript) files in the config plane, bundled by the runtime
at load with esbuild; there is no build step in the repo. They run on goja,
an ES2020-class engine: **synchronous code only**, no `async`/`await`, no
Node or browser APIs, no npm packages. Imports between your own files work
(`./lib/registry`), plus one virtual module, `"mutiro"`.

| Kind | Where | Exports | Runs when |
|---|---|---|---|
| Tool extension | `.genie/tools/<name>.ts` (shared code in `.genie/tools/lib/`) | `tool`, `run` | the model calls the tool |
| Hook | `.genie/hooks/*.ts` (all files form one program) | `onMessage`, `beforeTool`, `beforeReply` | around a turn |
| Page handler | `handlers.ts` beside a page's `index.html`, anywhere under the root | one function per action | a page calls `mutiro.request(action, payload)` |

Every one of them receives `tools`: the caller's own tool surface as
synchronous functions, `tools.notes_list({ subject })`. The role
boundary is the caller's, so a user-triggered run holds a user's tools. A
tool that fails returns an object with an `error` field rather than
throwing.

Two exceptions from `"mutiro"` carry meaning:

- `throw new ValidationError("...")`: a refused business request. The
  model (or the page) sees the message as the error; nothing else happens.
- `throw new Handoff("reason")`: a hook or handler declining to decide,
  so the request goes to the agent for a turn.

Any other exception is a failure reported with your file and line.

Limits that shape the code: a run has 60 seconds including its tool
calls; extensions may nest 8 deep; up to 128 tools, 256 KiB per file,
4 MiB in total. Imports are relative and stay inside the config root;
a bare import (`lodash`) is refused, so vendor the file. Only top-level
files in `.genie/tools/` are tools; `lib/` and other subfolders are
imported code. A sequence of tool calls is not a transaction: no
rollback, no retry.

Runnable examples of every kind, with tests: `../examples/` (its README
lists what each file shows). The code below is taken from them.

## Tool extensions

A tool is a file exporting its metadata and its function:

```ts
import { sql } from "./lib/store";

type Args = { subject?: string; limit?: number };

export const tool: ToolDefinition = {
  name: "notes_list",                          // the model calls this name; must match the file name
  description: "List notes, newest first, ...", // model-facing prose; the evals depend on it
  displayName: "List Notes",
  group: "Notes",
  signalText: { en: "Reading notes", "pt-BR": "Lendo as notas" },
  inputSchema: { type: "object", properties: { subject: { type: "string" }, limit: { type: "integer" } } },
  owner_only: false,
  requires: [{ kind: "connection", name: "supabase" }],
};

export const run: ToolRun<Args> = ({ args, tools, context }) => {
  const rows = sql(tools, "select id, subject, text from notes order by created_at desc limit $1", [args.limit ?? 20]);
  return { count: rows.length, notes: rows };
};
```

- `inputSchema` is a JSON Schema subset: `type`, `properties`,
  `required`, `items`, string `enum`, `nullable`, `description`. Any other
  keyword fails at load. It is what the model sees and what `dev types`
  turns into the `Args` type of `tools.<name>()` for other code.
- `run` returns an object; anything else reaches the model wrapped as
  `{ result: <value> }`.
- `context` is set by the runtime, never by the model: `username`, `role`,
  `conversation_id`, `extension`, `execution_id`. Use it for authorship.
- `requires` declares a dependency (`connection`, `secret`, `mount`,
  `backend`); without it the tool is not offered.
- `.genie/tools/settings.json` with `{"extensions_only": ["supabase_sql"]}`
  keeps a built-in tool callable from extensions but hidden from the
  model. This is how a raw capability becomes a safe vocabulary: the
  model gets `notes_*` verbs, never SQL. Some tools are extensions-only
  by the platform and cannot be opened to the model (`endpoint_invoke`);
  an image can set it too, and the desktop and web apps show such a tool
  locked as "Extensions and hooks only". A setting for a tool the agent
  does not have stays dormant. `owner_only` still applies to calls made
  from extensions and hooks.
- Descriptions are behavior. Change them deliberately, never as a side
  effect of a refactor; a description change deserves an eval run.
- Factor what every tool repeats into `lib/`: the store access
  (`lib/store.ts` in the examples) and, once a group grows, the shared
  metadata (`export const { tool, run } = groupTool<Args>({...})`), so a
  tool file states only what is its own.

**Design rules.** Start from the process steps and the identity the agent
holds at each step, not from the tables: too many tools means more to
explain and more rules about which to write. Every tool that addresses an
entity accepts every identity the agent might be holding (key, reference
plus customer, external ids) through one shared resolver; otherwise the
model translates ids "in its head" over a whole list and creates
duplicates when the join drops rows. An idempotent create refuses or
resolves to the existing record, never creates-and-warns: a warning fired
on legitimate siblings trains the model to ignore it on real duplicates.
Validate only what the branch needs; a lookup path that demands an
argument only creation needs makes the caller fall back to creating.
Uniqueness and identity are database constraints, not resolver code; for
operational state prefer one mutable row per entity plus an append-only
events table over a fact store with folds. List tools return summary rows
and exclude closed records by default, detail stays behind the get tool,
and the descriptions say so ("list is for enumeration, get for detail"):
an unfiltered list that returns every record's full detail costs tens of
thousands of tokens per call. A deterministic reconciliation is a tool that stores the raw
external snapshot, computes the change set in code, writes the facts and
returns the change set; the model handles the change set only. Over
`supabase_sql`: batch writes (one insert for a listing, not one upsert per
row), bind JSON with `JSON.stringify` and `::jsonb`, compare dates by day.

A guard tool is a pre-action
license, not post-action bookkeeping: a send-once check the model is
meant to call after emailing gets skipped; called before the send, its
refusal blocks the send. Every question the users' guide advertises needs
a tool that answers it, so check the surface for enumeration holes (a
`find_x` without a `list_x`): a missing lister sends the agent to file
browsing, which returns nothing in a user seat and reads as "there are
none". The ledger is written by the tool that changes state, never by an
instruction to log: a "log every request" rule fires a few times and
decays to silence while still looking authoritative.

Return measured facts, not summaries: include what was
not found or skipped. Refuse with `ValidationError` and a message that
tells the model what to do instead ("this note exceeds 280 characters;
condense it without dropping facts"). Keep each tool a single verb with a stable
shape; the model composes them. Write the fact (an event row, a log line)
in the same tool that changes state, so the trail cannot drift from the
change.

## Hooks

The hooks folder is one program: every file's exports are merged, so one
file per concern is fine. Three names are recognized:

```ts
import { ValidationError } from "mutiro";

// Before the model's tool call runs. Return { args } to rewrite the
// arguments, nothing to allow as-is, or throw ValidationError to refuse.
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

// When a message arrives, before the model sees it. Return { skip } to drop it,
// { reply } to answer without a turn, { result } for an action, nothing to pass on.
export const onMessage: OnMessage = ({ payload, tools }) => { /* payload.text, payload.from, payload.action */ };

// Before the reply leaves. Return { text } or { parts } to rewrite it.
export const beforeReply: BeforeReply = ({ reply, to, tools }) => { /* ... */ };
```

Rules of the three hooks:

- Hooks and `hooks/settings.json` are read again on every call: a push
  applies on the next message, no restart.
- `onMessage` runs as the sender, before the turn. Mixing outcomes
  (`{ skip, reply }`) is a failure. A failure or a `Handoff` still runs
  the turn, with the reason in front of the model. Three consecutive
  failures disable the hook in `.genie/hooks.state.json` until fixed.
- `beforeTool` runs before every model tool call and before a page
  handler's calls. `Handoff` allows the call. Any throw other than
  `ValidationError` refuses the call every time; it never auto-disables.
  The `tools` it receives are the unguarded originals, so a gate cannot
  loop on itself.
- `beforeReply`: a `ValidationError` withholds the reply and gives the
  model one retry turn; a second refusal ends the turn with nothing sent.
  Any other throw withholds the reply (enforcement fails closed); `Handoff`
  sends it unchanged; returning both `text` and `parts` is a failure.
- A hooks folder that fails to build **fails closed**: tool calls are
  refused until it is fixed. `check` before every push.
- `.genie/hooks/settings.json` turns a hook off without deleting it:
  `{ "beforeReply": { "enabled": false, "reason": "Maintenance" } }`.

A rule that gates one tool is a `beforeTool` hook, not a dependency
between two tool packages: a connector client that imports another
group's library cannot be used without that group.

A hook is where a rule becomes enforcement. The note-length example
refuses oversized notes on every guarded call and trims outer whitespace
on accepted calls. The refusal tells the model how to retry; the hook
never silently truncates the user's facts.

### Judgment in code: `tools.decide`

Code can branch only on what it can compare. When a rule needs a judgment
the data does not state (what kind of message this is, whether a draft
gives away something internal, whether a human must see it first), ask the `decide`
tool and branch on its typed answer: one call, several questions, no
turn. It is the System One call, answered by a model built for typed
decisions rather than prose, and it is available to hooks, to tool
extensions and to the model alike. It is what makes a hook or an extension
able to hold a rule that needs judgment without becoming a turn, and it
is priced per input token, so `state` carries only what the questions
need.

```ts
const r = tools.decide({
  state: payload.text, // only what the questions need; the call is priced per input token
  questions: {
    kind: { type: "choice", instructions: "What is this message?",
            criteria: { request: "asks for something to be done", update: "reports a fact about a payee", noise: "auto-reply, newsletter, bare thanks" } },
    urgency: { type: "score", instructions: "How urgent?", criteria: ["routine", "today", "urgent"] },
    human: { type: "noul", instructions: "Does this need a human before any reply?" },
  },
});
if (r.error) throw new Handoff("triage unavailable: " + r.error.message);
r.answers.kind.choice;   // one of your criteria keys, never anything else
r.answers.urgency.score; // 0-based position on the scale, fractional when calibrated: compare with >=
r.answers.human.noul;    // 0 to 1
r.backend;               // "systemone:<model>" or "model:<model>"
```

Hosted agents call Mutiro's System One service. The platform supplies the
endpoint and credentials and selects the backend; the owner does not need
to set a `SYSTEMONE_API_KEY` agent secret. Omitting that secret does not
switch a hosted agent to its chat model.

For **self-hosted agents**, a `SYSTEMONE_API_KEY` secret selects the System
One API; without it, the agent's own Gemini model answers (a Gemini
provider is required for this fallback). That choice belongs to the
owner's runtime setup, never the hook.

The two kinds of answer do not mean the same thing by a number. System
One returns calibrated probabilities; a chat-model backend returns
its own likelihood estimate. `confidence` is optional answer metadata:
a calibrated `noul` can omit it, so its absence does not identify the
chat-model backend. The `systemone:` backend prefix identifies the API
path, which may go through Mutiro's service; it is not proof of calibration
either.

Choose thresholds for the configured backend and verify them with evals.
Use 0.5 as a simple yes/no cutoff; treating 0.8 as an 80% probability
requires a verified calibrated backend. The current `tools.decide`
response has no explicit calibration flag. If a rule depends on calibrated
probabilities, establish that guarantee from the runtime/platform
configuration and hand off when it cannot be established; do not infer
it from optional fields or silently substitute a different threshold.

Two shapes that recur. Triage before the turn, handing the model a fact:

```ts
export const onMessage: OnMessage = ({ payload, tools }) => {
  if (payload.role !== "user") return;
  const r = tools.decide({ state: payload.text, questions: { kind: KIND, human: HUMAN } });
  if (r.error) return; // no judgment: the turn handles it
  if (r.answers.kind.choice === "noise" && yes(r.answers.kind, 0.9)) return { skip: true, reason: "noise" };
  throw new Handoff("triage: " + r.answers.kind.choice + (yes(r.answers.human, 0.8) ? "; needs a human before any reply" : ""));
};
```

And a guard on what leaves, which fails closed when it cannot judge:

```ts
export const beforeTool: BeforeTool = ({ name, args, tools }) => {
  if (name !== "email_send" && name !== "email_reply") return;
  const r = tools.decide({ state: String(args.body || ""), questions: { leak: { type: "noul", instructions: "Does this outgoing text reveal internal-only information?" } } });
  if (r.error) throw new ValidationError("the leak check is unavailable; do not send until the owner looks");
  if (r.answers.leak.noul > 0.5) throw new ValidationError("draft reveals internal-only information");
};
```

Hooks are developer code: the agent cannot write or change them, so a
rule an owner asks for in conversation becomes a change in the repo, a
test in `tests/`, and a push.

## Page handlers

A page under `shared/` (or anywhere under the root) is HTML the user opens
from the workspace. It has no server: `await mutiro.request("loadStatus", {})`
lands as a message in the conversation the page is open in. If the
handlers file beside the page exports a function of that name, the host
runs it with the viewer's tools and no turn; otherwise the agent handles
the request in a turn following the page's `HANDLERS.md`. A handler
returns the page's result object or throws `ValidationError`.

```ts
export const loadStatus: Handler<{ limit?: number }> = ({ payload, tools }) => {
  const res = tools.notes_list({ limit: payload.limit ?? 50 });
  if (res.error) throw new ValidationError("Notes could not be read: " + res.error.message);
  return { subjects: groupBySubject(res.notes), updated_at: new Date().toISOString() };
};
```

The host rebuilds `handlers.ts` on every request, so a push applies at
once (a plain `handlers.js` is also supported). Unlike tools and hooks,
pages and their handlers are agent-editable, so the agent can grow a page
in conversation; pull those edits back into the repo (`tuning.md`).

A handler imports only from its page's own folder; results are capped
at 64 KiB; three failures disable the action in `handlers.state.json`
beside the page until the file is fixed. Action names must be valid
function names (camelCase); any other name runs as a turn. Handlers do
not get `extensions_only` access: they call the tools the viewer holds,
which include the owner's extensions not marked `owner_only`, so a `notes_*` verb, not raw SQL,
is how a page reaches the database.

Drive a page from the CLI as the page would:
`mutiro user message action <agent> loadStatus '{}' --section shared --source status/index.html --wait`.
The payload is inline JSON, `@file` or `-` for stdin. The source is a
path inside `--section` (default `other`, which hides `shared/`, so a
page under `shared/` needs `--section shared`); `--root user:<name>`
addresses a page in that user's workspace. `--wait-timeout` defaults to
180 seconds; `--wait-turn` keeps waiting until the turn ends and reports
any chat replies it sent.

Grow a handler, do not write it up front: ship the page with the contract
only, watch real payloads arrive as turns, then write the function for
the routine path and keep `Handoff` for what needs judgement. Think of it
as an HTTP handler that holds exactly the turn's tools. When a tool's
output shape changes, rerun every handler test that reads it in the same
change: a handler that parses a field the tool no longer returns shows
every record with a default value and no error.

An extension whose name collides with a tool the image declares is
refused at boot. Migrate under a temporary prefix and cut over in one
sequence. Push never deletes by default, so the old files stay loaded
beside the new ones. `--prune` (off by default) deletes files the last
deploy recorded that the local directory no longer has, but a first push
or a `mark` records every file on the agent, including files the agent
made itself; prune only in a repo that owns every synced file.

Pages open on phones as well as desktops (the mobile app renders the same
workspace), so every page is mobile-responsive from the first version: a
viewport meta, a single column under about 600px, tables that scroll or
collapse to cards, controls large enough to tap. A dashboard that only
works on a laptop is a dashboard the operator cannot read where the
question arises. Put the rule in the manual or the page skill the agent
follows. Checking it needs no phone: open the page in the web app
(app.mutiro.com) and drag the workspace divider to different widths; the
page reflows exactly as it will on a small screen.

Keep `HANDLERS.md` beside the page current: it is the contract the page
was written against and the procedure the agent follows when there is no
function. Anything deterministic (mapping rows, filtering, formatting)
belongs in `handlers.ts`; anything needing judgement stays a procedure.
The bundled `workspace-html` skill is what the agent itself follows when
it writes pages; read it for the page side.

## Checking it offline

`mutiro agent dev check|run|test|types`, the `mutiro/test` harness, mocks,
`mutiro.d.ts` and `tsconfig.json`: `dev.md`. Run `dev check` before every
push.

## Where the logic goes as it grows

Extensions are the right first home for business verbs: no image, no
service, deploy with a push, test in seconds. They stay right while each
verb is a thin, synchronous layer over the tools the agent holds. As the
work grows there are three places it can move to, in order of cost:

1. **An HTTP API the owner registers, called through `endpoint_invoke`**
   (`connections.md`). The verbs stay extensions; only the outside world
   moves behind a registered endpoint. This is the answer to "the engine has
   no I/O": a CRM, a partner's API, your own backend. No Mutiro release,
   two secrets, a folder of verbs. The tool is extensions-only by the
   platform, so the model still sees only your verbs.
2. **A Supabase Edge Function in your project, called through
   `supabase_invoke`.** For logic that is a system rather than a verb: a
   reconciliation with its own state and history, parsing that needs a
   library, work that outgrows the 60-second extension run or the 1 MiB
   result. The function runs as the agent's data role, deploys with your
   Supabase CLI, and holds its own keys. Long work is started by one call
   and collected by another.
3. **The agent image.** Two reasons justify one: a capability that must
   live next to the agent, such as MCP servers, a language runtime and
   libraries the code needs, or a headless browser, none of which a function
   elsewhere replaces; and verbs many agents would want unchanged
   (`structure.md`, where a thing belongs). Hosted images are built by
   Mutiro, so this path is a request to Mutiro (or a self-hosted agent)
   rather than a push, and business logic that is one agent's stays in
   that agent's repo and project.

Signals that a verb has outgrown its extension: you are batching or paging
to fit the run deadline or the result cap; a several-hundred-line file
mirrors an external API by hand; the tool list needs a map to explain which
verb to call when, at which point a few higher-level operations behind an
API and a smaller set of verbs give the model fewer choices.

A registry of about twenty verbs plus a sync from an outside system is the
typical split: the verbs stay extensions, the outside system becomes a
registered endpoint, and the deterministic sync (store the raw snapshot,
compute the change set) is the piece that earns a function. Whatever moves, keep the
contract: the tool names, descriptions and schemas the evals bind to, with
the implementation behind them. Hooks stay where they are; a gate is a
runtime concern whatever the backend.

## Deploying extensions

After `mutiro agent files push`, hooks apply on the next call and page
handlers on the next request. Tool extensions load at the agent's boot:
a new or changed tool is live at the next wake, or immediately with
`--restart` (which interrupts any active conversation). A pushed tool
whose `check` failed is a boot error on the agent: run `check` and
`test` before every push.
