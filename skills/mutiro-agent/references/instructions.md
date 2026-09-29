# Writing instructions that hold

The config plane is prose the model reads every turn. These rules come from
failures found by running agents, not from style preference.

## Where a rule goes

- Identity and voice: `.agent_instructions.md` (the soul, always in context).
- Rules for every conversation: `.genie/AGENTS.md` (the manual).
- Rules for the owner and developers only: `AGENTS.md` at the agent root.
- Procedures and hard output formats: a skill under `.genie/skills/<name>/SKILL.md`.
  The description is always visible; the body is injected only when the skill is
  invoked, so long templates cost nothing until needed.
- Per-user behavior: `users/<username>/AGENTS.md`.
- Reference content the agent and its pages read: `shared/`.
- One-shot guidance for one user's next turn: `users/<user>/ONEOF_AGENTS.md`
  (written via the agent; injected once, then deleted).

Only one context file per workspace loads (`GENIE.md` shadows `CLAUDE.md`
shadows `AGENTS.md`); see `structure.md` for precedence and when each lands.

Agent files carry rules, procedures and examples, never incident history.
Keep the shape of the failure, drop the anecdote; lifecycle goes in issues and
commits.

## Skills

A skill is `.genie/skills/<name>/SKILL.md` plus any supporting files. The
frontmatter is required and `name` must equal the directory name:

```yaml
---
name: note-card
description: Render a note as the team's HTML card. MUST be used for every card shown to a user. Never write card HTML from memory.
metadata:
  mutiro.requires-tools: "notes_list"       # optional, space-separated; all must be held
  mutiro.requires-capabilities: "owner_conversation"  # optional: owner_conversation, workspace_html_preview
---
```

The description is the only part the model always sees: write it as the
trigger ("MUST be used for every..."), not as a summary. The body is the
procedure or template, injected when invoked, so it can be long and exact.
Bundled skills (`workspace-html`, `mutiro-guide`) are overridden by a copy
in `.genie/skills/<name>/` and hidden with `disabled:` in
`.genie/skills/settings.yaml`, the only key that file accepts.

Published skills (`supabase-data`, `supabase-schema`, `bkper`,
`bkper-review`, `gmail`, `mail`) come from github.com/mutirolabs/skills
releases and switch on when their tools are present. A local skill with
the same name replaces the content but keeps the platform's tool
requirements. Self-hosted, `MUTIRO_SKILLS_RELEASE` picks the release:
`latest` (default), `off`, or a `vX.Y.Z` tag.

`install_skill` (owner-only by default) writes into `.genie/skills/<name>/`
on the agent; the next `files pull` shows it as drift.

## Rules

- **Rules, not guidance.** Trust the model with the why; state the what.
- **When compressing, names and prohibitions survive verbatim** — only
  justifications get cut. A directory name or a "do not X" reads like
  prose right up until deleting it changes behavior.
- **Examples are copied literally, tense included.** An example reply
  ending in a promise teaches the agent to promise instead of act. Make
  examples generic (nothing from the current client) and end them in
  delivered work, past tense. Use an example only where a stated rule
  demonstrably failed — for output shape, an example is the terser spec.
- **Verify by running, not re-reading.** Every instruction change gets a
  one-probe behavior check from a cleared context. A lost rule or a
  parroted example shows up when the agent runs, not when the text is
  reviewed.
- **A claim of verification carries its evidence.** Agents will write
  "verified" over checks that never ran. Require the quoted line or the
  measured number; "not verified" is a legitimate state.

## Capability before behavior

An agent's tool surface is what its image declares, not what the config
repo ships. Images carry their own tool list; a tool that exists in the base can be absent on a hosted agent, and
the agent will not know it is missing. Before tuning instructions around
a tool — and before believing "there is no such tool" or "I would call
X" — read the live surface:

```bash
mutiro agents tools list <agent>
```

A tool not listed there, enabled or disabled, is an image gap: ask Mutiro,
or run the agent self-hosted. A simulated probe
("no tools, just tell me what you would call") cannot catch this — the
model names tools from the platform instructions whether or not it holds
them.

## Hot path in the manual, cold path in a skill

A skill costs a turn to load and a turn to run. A procedure the agent runs
on every turn (identify the sender, read its record, append a log line:
ten lines each) belongs in `.genie/AGENTS.md`, already in context. A
procedure that is occasional and schema-heavy (bootstrap, add or update a
record, change a policy) belongs in a skill, with a one-line guard in the
manual: "writing to X without skill Y in context: stop". Prevents paying
a skill-load turn on every email, or bloating the manual with schemas
needed once a week.

## Data the model reads is instruction

- **One rule per row.** A row packing two rules ("fee 20, mandatory")
  gets read as one of them and the other is dropped. Split the rules; an
  adjustment names its base ("add 20 to the cost the supplier reports;
  the user sees only the final value").
- **Observed facts are autonomous, policy is not.** The agent records
  identity and operational facts on its own; it writes a business rule
  only when a named human instructs it, logged as such. History mined by
  the agent yields a proposal table with evidence, never policy. Prevents
  an exception applied once becoming a standing rule.
- **Namespace what the guard refers to.** Prefix the agent's own stores
  (`register-*`) so one pattern scopes a mutation guard and a bare name
  (`log`) cannot become a dumping ground.

## Routines the agent runs on its own

- **Define a routine by the set it walks, from the agent's own records**
  ("everything I know that is not closed"), then join to the external
  source. A routine defined as two statuses of the external listing
  skips every known record the source now calls complete.
- **One scheduled prompt, in the owner conversation, that scans once and
  messages each operator**; the run writes nothing, the write happens on
  the operator's reply in their own conversation. Not one schedule per
  operator, not a routine that closes records without a human's word.
- **An install step is one operation.** "Copy this folder" holds; a
  multi-step procedure (read this, then that, then write) gets shortcut
  by a small model and nothing enforces it, so the result drifts from
  what the procedure promised.
- **Descriptions and schema examples outrank the manual.** The model
  copies a tool's example values; a manual asking for one vocabulary
  loses to a description listing another. Keep vocabulary in the
  schema as an enum, or keep examples out of it.

- **Two honest outcomes.** A routine produces its artifact, or nothing
  when there is nothing to report; an audit routine always reports one
  line, so quiet cannot mean "healthy or broken". A chatty "already done"
  is neither and is the tell of fabrication.
- **No standing intentions.** "After they answer, tell me" never runs:
  nothing wakes the agent when someone else acts. Make it a pull ("ask
  later") or a scheduled prompt.
- **Evidence discipline for external systems.** A measured fact is not a
  deduction; paginate to the end; quote counts; a routine's report states
  its own footprint ("106 rows in 2 calls") so a partial sweep cannot pass
  as complete.

## Behavior, not plumbing

- A rule uses only concepts the agent already has. "Files exist only in
  the owner workspace" injects a theory it has no use for; "record
  questions go through the records tools, an empty file search says
  nothing about the records" is the same rule as behavior.
- Messages to operators and end users carry no implementation vocabulary
  (API, endpoint, tool names, JSON, status enums). Translate state words
  to business meaning at the boundary.
- Tool-result presentations follow a house style stated once in the
  manual (same tables, same field order as the rest of the output), and
  every outbound message type has its own template skill, or its shape
  drifts daily.
- When a new representation of existing data appears (a frozen table, a
  cached summary), spec it with the full field list of the artifact it
  feeds; the weaker spec wins by imitation, and "if available" is the
  escape hatch.
- Pin measured quirks of an external system in the tool's description
  (page size, how to paginate, what a status word means) so a cold model
  does not rediscover or invent them each session; name every field the
  model must supply both in the description and in the skill.
- Keep tool schemas flexible until an eval proves the model drops a
  field; write the hardening trigger down ("when case X goes red") rather
  than hardening speculatively.

## Rules key on intent, not channel

The same human intent through different channels (a forwarded email, a
pasted text, a chat request) gets one rule. A per-channel distinction must
be justified by a real risk difference, or the user reads the agent as
inconsistent: a fast path for forwards and a readback gate for pastes
guard against the same extraction risk.

## Single-source bindings

Address roles in rules ("the team lead"), and bind role to person in exactly
one place. When the person changes, one line changes. One term per role in
agent files: a synonym ("operator") reads as a second authority. With
several humans in a role, define it per work item ("whoever brought the
request, if on the list"), name the default for unowned items, and say
that unknown origin also falls to the default, never to whoever spoke
last. The same goes for
templates: one skill owns each template and every other file points at it.
