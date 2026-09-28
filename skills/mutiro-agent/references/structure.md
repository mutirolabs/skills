# Structure: the agent directory, the workspace, who sees what

An agent is a directory in a git repo. That directory is the **config
plane**: everything that decides how the agent behaves, synced to the
running agent with `mutiro agent files`. Around it live two things that
are not config: the **state plane** the runtime writes for itself, and the
**conversation workspace** the agent produces work in. Knowing which is
which decides where a change goes and how it gets there.

## The agent directory

```
notes/                                 one agent: @notes_desk_x1w1
├── .agent_instructions.md             soul: identity, voice, priorities; every turn, every conversation
├── .genie/
│   ├── AGENTS.md                      manual: rules for every conversation
│   ├── skills/<name>/SKILL.md         procedures and templates; description always visible, body on demand
│   ├── skills/settings.yaml           disabled: [...] bundled skills to hide
│   ├── tools/<name>.ts                tool extensions (extensions.md); lib/ for shared code
│   ├── tools/settings.json            { "extensions_only": [...] }
│   ├── hooks/*.ts                     onMessage / beforeTool / beforeReply
│   └── hooks/settings.json            per-hook enabled flags
├── AGENTS.md                          owner-workspace context (the agent root is the owner's workspace)
├── users/<username>/AGENTS.md         per-user behavior; that user's conversations only
├── shared/                            owner-curated content for the agent and its users; pages live here
│   └── status/{index.html, handlers.ts, HANDLERS.md}
├── evals/*.yaml                       behavioral tests (evals.md); NOT config plane, never syncs
├── tests/*.test.ts                    unit tests for tools/hooks/handlers (extensions.md); never syncs
├── tsconfig.json                      committed; mutiro.d.ts is generated and gitignored
└── .prettierrc
```

### What syncs

`mutiro agent files` transfers exactly these paths and nothing else:
`.agent_instructions.md`; `AGENTS.md`, `GENIE.md`, `CLAUDE.md` at the
root; `.genie/AGENTS.md`; `.genie/skills/**`; `.genie/hooks/**`;
`.genie/tools/**`; `users/*/AGENTS.md` (and GENIE/CLAUDE, only at a user
root); `shared/**`. Everything else in the directory stays local:
`evals/`, `tests/`, `tsconfig.json`, `.prettierrc`, `mutiro.d.ts`. That is
deliberate: the agent must never see its own tests.

### The four layers of context

Every turn the model sees, in order: the platform's own instructions, the
soul (`.agent_instructions.md`), the manual (`.genie/AGENTS.md`), then the
workspace context file for the conversation (`AGENTS.md` at the root for
the owner, `users/<x>/AGENTS.md` for user `x`), then skill descriptions,
then memory. A skill body enters only when the model invokes the skill.
Where a rule goes follows from this (`instructions.md`).

### Owner and users

An agent has one owner and any number of users (the allowlist). **The
workspace resolves per conversation**: the owner's conversation runs at
the agent root with every `users/<x>/` beneath it; a user's conversation
is sandboxed to `users/<x>/` by path checks. The same holds for tools:
`owner_only` tools and owner-only built-ins (send to anyone, scheduling,
`bash`) are absent in a user's conversation, and a tool extension or
handler triggered by a user runs with that user's tools. A **service
member** is a platform member that delivers events to the agent instead of a
person: an email connector's inbox, an inbound webhook's sender. It is a user
like any other, with its own conversation and `users/<member>/AGENTS.md`,
and the turns it triggers run with a user's tools.

Developers granted with `mutiro agents developers grant` hold owner
standing for every command in this guide except writing into another
user's conversation as the agent.

## The state plane (never in the repo)

The runtime keeps its own files beside the config plane. They are hidden
from the workspace and refused by sync:

- `.mutiro-agent.yaml` (hosted: rendered from the image template at every
  boot), `.env`, `.mcp.json`;
- `.mutiro-deploy-marker.json`: labels (`git_commit`, dirty flag,
  `--meta` pairs) and a per-file hash baseline from the last push or mark;
  the drift guard reads it;
- `.mutiro-tool-overrides.json` (the Tools tab's enable/disable),
  `.mutiro-tool-inventory.json`, `.mutiro-tool-declarations.json` (what
  `dev types --agent` reads);
- `.genie/sessions/**` (traces), `.genie/hooks.state.json`,
  `handlers.state.json` beside a page (auto-disable records);
- `.genie/bundled-skills/**`, `.genie/published-skills/**`;
- `MEMORY.md` (the agent's durable memory, `memory_write`),
  `.mutiro/memory/runtime/<conversation>/working_memory.yaml`,
  `.mutiro/sheets/**`.

Two special files the owner reaches only through the agent:
`users/<user>/ONEOF_AGENTS.md` (a one-shot instruction, injected on that
user's next turn and deleted) and `MEMORY.md`. Hand-curated context never
goes in memory; it goes in the AGENTS.md files.

## Where growing data lives

`shared/` is deployable config: it changes by commit and push, and the
agent can also edit its content in conversations with owner standing.
It is read-only in ordinary user conversations. Keep growing operational
data (customers, contacts, policies, logs) in a runtime-writable store: a
tool extension over a database, or sheets. Define the ontology (tables,
write rules) in guidance and give the agent verbs, not files. Operational
data never rides in the syncable set, or a config push clobbers the live
state; its only writer is the toolset. Prevents a
register that needs a repo commit per new contact.

Two facts about per-user stores such as sheets: access is evaluated per
conversation user, so a store the owner sees can be invisible in another
member's conversation while everything else works (routing correct, no
error, no register); and ownership follows the conversation that created
the store, so create shared state deliberately from the owner seat and
guard visibility with an eval run as each member.

`shared/` is also client-facing: anything pushed there is read by the
customer's team. No platform admin names, no repo or test-suite
references, and pages as complete HTML documents.

## The conversation workspace

What the agent makes is not what you push. Pages, notes, downloads,
state files the agent keeps: outside the config-plane paths, they live in
the workspace and `files pull` never shows them. Edits under `shared/`
remain part of the config plane and do come back through `files pull`.
Read workspace output with your own standing, without waking the
agent:

```bash
mutiro user workspace ls [-R] <agent> <path>        # sections: shared, other (agent's working dir), downloads
mutiro user workspace cat <agent> <path>
mutiro user workspace preview <agent> <page> --json # mint a page link (carries a token: keep it out of logs)
mutiro user workspace ls <agent> <path> --root user:<name>   # a user's private root, as owner
```

Sections: `shared` is the owner-writable content the users also see;
`other` is the agent's own working directory (the root, for the owner);
`downloads` is where a user's uploads and fetched attachments land.
Behavior files (the config plane minus `shared/`) are read-only in the
workspace; tools and hooks source is read-only even to the agent itself.
Pages under `shared/` are the exception: the agent can edit them in
conversations with owner standing, and you bring those edits back with
`files pull`. Ordinary user conversations can read shared content but
cannot write it; tools and hooks source remains read-only to the agent.

## Sync, in one picture

```
repo (git)  ── push ──▶  agent (config plane)  ◀── the agent self-edits (manual, pages, per-user files)
   ▲                             │
   └────────── pull ─────────────┘        then commit, then mark (re-baseline the deploy marker)
```

Run `files pull|push` from the repo root with the agent directory as the
argument. A pull run from inside the agent directory with `./<agent>`-style
paths lands the files one level too deep (`<agent>/<agent>/`), and the
next push then sees them as new files.

`push` overwrites file by file with no merge and refuses to rewrite a file
edited on the agent since the last deploy (`--force` overrides, `--prune`
deletes what the last deploy recorded and the repo no longer has).
Commit before pushing: the deploy is labeled with the repo commit, and a
dirty tree is labeled dirty. Tools, hooks, a new skill and a changed skill
description are read at process start, so a push of those is live with
`--restart` or at the next cold start; the manual and skill bodies reload
per conversation or invocation. The full
routine and its traps are in `tuning.md`.

## Where a thing belongs

Place a thing by who would want it unchanged: the platform, if a second
unrelated agent would; the image, if a second client in the same trade
would; the client's repo, if only this agent would. A client's data
project and its migrations live in the client repo, and nothing shipped
in an image touches the client's database.

## Beyond the files

Things an agent has that are not files in this directory, managed in the
control plane (desktop or `mutiro agents ...`), documented in the repo's
README so the repo tells the whole story:

- **Tools on/off and owner-only**, connectors (Gmail, email, Supabase), secrets, the allowlist, the model.
- **Memory**: `MEMORY.md` per workspace, working memory per
  conversation, and **recall** over conversation history (`recall`,
  `recall_get`; ambient recall injects snippets before a turn).
- **Reactions reach the agent** as a threaded message
  (`[reacted ✅ to #msgid]`), preserving which message the reaction refers to.
- **Scheduled routines** are schedules from the owner to the agent:
  `mutiro user schedule create --recipient <agent> --instruction "..." --cron "0 11 * * *"`
  (also `--interval-every`, `--once-at`, `--catch-up`). The fired message
  is a turn, so the agent reads its manual and skills. The agent's own
  `schedule_message_*` tools send messages out; they do not schedule its
  own turns. Keep the instruction a dumb trigger with `/clear` as its
  first line (it clears context before the turn) and put the behavior in
  a skill; an identical daily prompt without `/clear` is dedup bait, the
  agent sees yesterday's completion and answers "already done" with zero
  tool calls. A memoryless routine needs every set it acts on to be a
  query: anything old runs carried in conversation history needs a tool
  or a status.
- **Sheets** (opt-in): named typed tables the agent keeps under
  `.mutiro/sheets/`, shareable to users, exportable to xlsx/csv.
- **Skills discovery order**: `.claude/skills/` in the agent dir,
  `.genie/skills/`, `$HOME/.genie/skills/`, published skills, the Mutiro
  bundle (`workspace-html`, `mutiro-guide`). Copy a bundled skill into
  `.genie/skills/<name>/` to customize it; list it under `disabled:` in
  `.genie/skills/settings.yaml` to hide it.
