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
│   ├── hooks/settings.json            per-hook enabled flags
│   └── bookmarks.json                 files pinned to the apps' quick menu (Bookmarks, below)
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
`.agent_instructions.md`; `AGENTS.md` at the root; `.genie/AGENTS.md`;
`.genie/bookmarks.json`; `.genie/skills/**`; `.genie/hooks/**`;
`.genie/tools/**`; `users/*/AGENTS.md`; `shared/**`. Everything else in the directory stays local:
`evals/`, `tests/`, `tsconfig.json`, `.prettierrc`, `mutiro.d.ts`. That is
deliberate: the agent must never see its own tests.

### The four layers of context

Every turn the model sees, in order: the platform's own instructions, the
soul (`.agent_instructions.md`), the manual (`.genie/AGENTS.md`), then the
workspace context file for the conversation (`AGENTS.md` at the root for
the owner, `users/<x>/AGENTS.md` for user `x`), then skill descriptions,
then memory. A skill body enters only when the model invokes the skill.
Where a rule goes follows from this (`instructions.md`).

- **A workspace's context file is its `AGENTS.md`.** Use `AGENTS.md`
  for every context file, and no other name.
- **Reading a file in a directory adds that directory's context file**
  for the rest of the engine's life: once the agent reads anything under
  `shared/<x>/`, `shared/<x>/AGENTS.md` is direction, not content.
- **Root `AGENTS.md` applies to the owner and developers only**; users get
  `users/<x>/AGENTS.md` instead.

### Owner and users

An agent has one owner and any number of users (the allowlist). **The
workspace resolves per conversation**: the owner's conversation runs at
the agent root with every `users/<x>/` beneath it; a user's conversation
is sandboxed to `users/<x>/` by path checks. The same holds for tools:
`owner_only` tools are absent in a user's conversation, and a tool
extension or handler triggered by a user runs with that user's tools.
Owner-only by default: `install_skill`, `Task`, the conversation tools,
`schedule_message_*`, `supabase_admin_sql`, `gmail_send`, and bkper
post/check/trash. `send_message` is open to users. Hosted agents have no
`bash`, git or code execution. `mutiro agents tools list <agent>` is the
truth for a given agent; the tool map is in `runtime.md`. A **service
member** is a platform member that delivers events to the agent instead of a
person: an email connector's inbox, an inbound webhook's sender. It is a user
like any other, with its own conversation and `users/<member>/AGENTS.md`,
and the turns it triggers run with a user's tools.

Developers granted with `mutiro agents developers grant` hold owner
standing in conversations and can run files push/pull and the dev loop,
evals as themselves, view-as reads, secrets, webhooks, schedules, and
start/stop. Owner-only:

- sharing and the allowlist, the profile, deleting the agent;
- connecting providers (OAuth), `agents move`, granting developers;
- sending as the agent into another user's conversation, so
  `--in-conversation-with` evals and `agent conversation clear`.

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

The owner and developers can read (not write) `MEMORY.md`, the AGENTS.md
files and skills in the workspace section `agent`. The memory audit:

```bash
mutiro user workspace cat <agent> MEMORY.md --section agent [--root user:<name>]
```

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

`shared/` is also user-facing: anything pushed there is read by the
agent's users. No internal names, no repo or test-suite references, and
pages as complete HTML documents.

## The conversation workspace

What the agent makes is not what you push. Pages, notes, downloads,
state files the agent keeps: outside the config-plane paths, they live in
the workspace and `files pull` never shows them. Edits under `shared/`
remain part of the config plane and do come back through `files pull`.
Read workspace output with your own standing, without waking the
agent:

```bash
mutiro user workspace sections <agent>                # roots and sections you can reach
mutiro user workspace bookmarks <agent>               # the quick menu, as you see it
mutiro user workspace ls [-R] <agent> <path>          # --section downloads|shared|agent|other (default other)
mutiro user workspace cat <agent> <path> [-o file]
mutiro user workspace pull <agent> <path> -o <dir> [--zip]
mutiro user workspace write <agent> <path> <file> --section shared   # or downloads; other refuses writes
mutiro user workspace preview <agent> <page> --json   # mint a page link (carries a token: keep it out of logs)
mutiro user workspace ls <agent> <path> --root user:<name>   # a user's private root, as owner
```

Sections: `shared` is the owner-writable content the users also see;
`other` is the agent's own working directory (the root, for the owner);
`agent` shows its memory, context files and skills, read-only;
`downloads` is where a user's uploads and fetched attachments land (the
apps label it "Uploads").

In the owner's conversation the model can write the whole config plane
except `.genie/tools/**`, `.genie/hooks/**`, `.genie/hooks.state.json` and
`.genie/bookmarks.json`: it can edit the soul, both AGENTS.md files,
skills and `shared/`. Those self-edits are what `files pull` brings back.
Ordinary user conversations can read shared content but cannot write it.

### Bookmarks

`.genie/bookmarks.json` pins files to a quick menu: the chat-header menu
on desktop and web, an app-bar sheet on mobile. It is config plane,
synced by `files push`, and read-only to the model.

```json
{"bookmarks": [{"label": "Dashboard", "path": "shared/dashboard/index.html"}]}
```

- `path` is relative to the agent directory; at most 50 entries; an
  entry without a label or with an unclean path is dropped, not fatal.
- A person sees a bookmark only if they can read its file: `shared/` →
  everyone; the agent root → owner and developers; `users/<x>/` → that
  user only (owner and developers can still open the file, but it is not
  in their menu).
- A bookmark whose file does not exist yet still shows, and works once
  the agent writes the file.
- A push shows in `workspace bookmarks` within about a minute; the apps
  remember the menu for up to half an hour, or until they restart.
- `mutiro user workspace bookmarks <agent> --root user:<name>` shows what
  that user sees.

Good use: pin a dashboard page the agent keeps under `shared/`.

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
dirty tree is labeled dirty. The full routine and its traps are in
`tuning.md`.

When a pushed change takes effect:

- hooks and `hooks/settings.json`: the next call;
- page handlers: the next request;
- tool extensions, a new skill or a changed skill description: a new
  process (`files push --restart`, or the next wake);
- the soul `.agent_instructions.md`: cached per process, so restart or
  the next cold start;
- the manual `.genie/AGENTS.md` and the root and `users/<x>/` AGENTS.md:
  cached per conversation engine, so after `/clear` in that conversation
  or a restart;
- skill bodies: the next invocation.

## Where a thing belongs

Place a thing by who would want it unchanged: the platform, if a second
unrelated agent would (ask Mutiro); the agent's repo, if only this agent
would. The agent's data project and its migrations live in the agent's
repo.

## Beyond the files

Things an agent has that are not files in this directory, managed in the
control plane (the apps or `mutiro agents ...`), documented in the repo's
README so the repo tells the whole story:

- **Tools on/off and owner-only**, connectors (`mutiro agents connections providers` lists them), secrets, webhooks, the allowlist.
- **Memory**: `MEMORY.md` (per workspace: the owner root and each
  `users/<x>/`) and working memory per conversation are injected every
  turn. `recall` and `recall_get` search this conversation's history on
  demand, including before a `/clear`. A `/clear` cuts chat history only;
  memory persists.
- **Reactions reach the agent** as a threaded message
  (`[reacted ✅ to #msgid]`), preserving which message the reaction refers to.
- **Scheduled routines** are schedules from the owner to the agent:

  ```bash
  mutiro agents schedule message <agent> $'/clear\nRun the daily audit: load the daily-audit skill and follow it.' \
    --cron "0 8 * * 1-5" --timezone America/Sao_Paulo
  ```

  (also `--interval-every`, `--once-at`, `--catch-up`). It lands in the
  owner's conversation with the agent even when a developer creates it;
  `--user <name>` lands it in the agent's conversation with that user
  instead, still sent as the owner, and that conversation must already
  exist. The fired message is a turn, so the agent reads its manual and
  skills. The agent's own `schedule_message_*` tools send messages out;
  they do not schedule its own turns. Keep the instruction a dumb trigger
  with `/clear` as its first line (it clears context before the turn) and
  put the behavior in a skill; an identical daily prompt without `/clear`
  is dedup bait, the agent sees yesterday's completion and answers
  "already done" with zero tool calls. A memoryless routine needs every
  set it acts on to be a query: anything old runs carried in conversation
  history needs a tool or a status.
  - **Set `--timezone`.** Without it the cron runs in UTC, so "0 8" fires
    at 08:00 UTC, not at your 8am.
  - **Key calendar work on "the first run since", not on a date.** A
    weekday-only cron never fires on a 1st that falls on a weekend, so
    "on the 1st, report last month's totals" silently skips; "the
    first run after the month turned", from a query, does not.
  - **`/clear` needs a real line break**, not the two characters `\n`:
    `$'/clear\n...'` in bash, `` "/clear`n..." `` in PowerShell.
  - **Verify, then fire once:** `mutiro agents schedule list <agent>` shows
    the schedule and its next run; `mutiro agents schedule run-now <id>`
    runs it immediately, so the routine is proven before the first
    unattended morning.
  - **A successful run means delivered, not done.** Check the outcome
    (the reply, the file, the row), not the run status.
  - Manage with `schedule pause|resume|cancel <id>`, `schedule executions`,
    and `schedule list <agent> --include-inactive` for paused, cancelled
    and completed ones.
- **Sheets** (on by default when hosted): named typed tables the agent
  keeps under `.mutiro/sheets/`, nine `sheet_*` tools including
  `share_sheet`, exportable to xlsx/csv; `sheet_read` also reads `.xlsx`
  and `.csv` files in the workspace.
- **Putting things in front of users**: `show_workspace_file` sends a
  clickable file card (anchor, line range, `auto_open`); a plain Markdown
  link does not open the preview. `send_card`/`update_card` send
  interactive **A2UI** cards (v0.9, basic catalog: flat components with
  ids, a `root`, buttons that emit a named event with context), rendered
  natively on mobile, desktop and web; see https://a2ui.org to learn the
  format. A click arrives as `[Card interaction: card=… action=…
  data=<json>]`, the text hooks and evals see. Keep each card's intent in
  a skill (or a guide under `shared/`): what the card is for, the fields
  it shows, its action names and context, and what to do on each
  interaction. The model then builds the same card every time instead of
  improvising one; leave visual design to the renderers. In desktop and web with the workspace sidebar open, each
  message carries `The user is currently viewing "<path>" in <scope>.`
  plus any selected text quoted with `> `; mobile does not send it.
- **Skills discovery order**: `.claude/skills/` in the agent dir,
  `.genie/skills/`, `$HOME/.genie/skills/`, published skills, the Mutiro
  bundle (`workspace-html`, `mutiro-guide`). Copy a bundled skill into
  `.genie/skills/<name>/` to customize it; list it under `disabled:` in
  `.genie/skills/settings.yaml` to hide it.
