# Runtime: where the agent runs, and what it can do there

An agent is two things: a **config plane** (the agent's directory in its repo:
instructions, skills, tools, hooks, shared content) and a **runtime** that
loads it (a Mutiro-hosted pod running the `mutiro` binary). This file is about the runtime. What the agent *should
do* is the config plane (`structure.md`, `instructions.md`); what it *can
do* is decided here.

## Install the CLI

```bash
curl -sSL https://mutiro.com/downloads/install.sh | bash   # macOS, Linux; MUTIRO_CHANNEL=beta by default
mutiro version
mutiro auth login <email>                                   # passwordless; a code arrives by email
```

On Windows, from PowerShell: `irm https://mutiro.com/downloads/install.ps1 | iex`
(the `curl | bash` line also works from Git Bash). The install adds `mutiro`
to the user PATH, which only shells started afterwards see; until the
session restarts, call it as `$LOCALAPPDATA/Programs/Mutiro/bin/mutiro.exe`.

Your shell has no terminal to type a code into, so `auth login` and
`auth signup` send the code and print the command that finishes the flow.
Ask the person for the code from their email, then run
`mutiro auth verify <email> <code>`. If the command instead fails with
`verification code is required`, the code was still sent: same next step.

`INSTALL_DIR` (`MUTIRO_INSTALL_DIR` on Windows) overrides the target directory. `mutiro --help` is the
reference for the installed version; every command below has `--help`.

## Hosted is the path

A Mutiro agent is a member of the platform, hosted by Mutiro: create it,
push its config plane, and the platform runs it. For most developers this
is the better path: nothing runs on their machine, there is no model key
or runtime to keep alive, and the agent is where its users are. A hosted
agent can be created from the web, mobile or desktop apps or the CLI; the
result is an agent username (3 to 20 chars, lowercase,
digits, underscore, with a unique suffix appended) that every command
below takes. Profile, allowlist and tool switches are server-owned:
nothing in the repo sets them.

```bash
mutiro agents create <username> "<Display Name>" --objective "<one sentence on what it is for>"
mutiro agents start <agent> | stop <agent>              # desired state of the hosted pod
mutiro agents tools list|enable|disable <agent> <tool>... [--owner-only]
mutiro agents connections providers | connect <agent> <provider>
mutiro agents secrets set <agent> NAME value            # env var for the agent and its MCP servers
mutiro agents allowlist set <agent> <users...>          # who may talk to it; no users = owner only
mutiro agents developers grant <agent> <dev>            # owner-level standing for a teammate
mutiro agent files push <agent> ./<dir>                 # deploy the config plane (tuning.md)
```

Most tuning happens against the live hosted agent. For heavy iteration a
**local burner** is a good option: `mutiro agents create <name> --self-hosted`
in a directory of its own, then `mutiro agent runtime start <dir>` (with
`stop`, `restart`, `list`) runs the same binary on your machine. It only
works once its `.env` is set: `MUTIRO_AGENT_API_KEY` (shown once at
creation) and a model key, `GEMINI_API_KEY` by default, or another
provider and model chosen in `.mutiro-agent.yaml` (`anthropic`, `openai`,
`ollama`, `lmstudio`). Push the same config plane to it and hammer it; a
burner has no connectors, so a hosted agent is still where connector
behavior gets verified. Genie runs sandboxed on the local runtime
(`sandbox.enabled` in `.mutiro-agent.yaml`), but it is your machine and
your keys; developers uneasy about that lose nothing by staying hosted. The host anchors everything to its working
directory: `.genie/AGENTS.md`, skills, `.genie/tools`, hooks and MCP
discovery are read relative to the agent's state dir.

### Tool surface

On a hosted agent the surface is decided in two places, neither of them a
file in the repo: the **image** declares which tools exist (the agent's
`.mutiro-agent.yaml` is rendered from the image template at every boot
and is never yours to edit), and the **owner** switches them on or off and
marks them owner-only in the desktop Tools tab or with
`mutiro agents tools enable|disable <agent> <tool> [--owner-only]`. The
one surface decision that does live in the repo is
`.genie/tools/settings.json`: `extensions_only: [...]` keeps a built-in
tool callable from your own tools but invisible to the model (the examples
do this with `supabase_sql`: the model sees `notes_*`, never raw SQL). On a
local burner the yaml's tool list plays the image's part; it replaces the
defaults rather than adding to them.

The built-in tools a hosted agent carries, by group (`(o)` = owner-only
by default):

| Group | Tools |
|---|---|
| Files | `listFiles`, `findFiles`, `readFile`, `writeFile`, `appendFile`, `editFile`, `copyFile`, `moveFile`, `removeFile`, `makeDirectory`, `searchInFiles`, `viewImage`, `viewDocument` |
| Orchestration | `Skill`; `Task` (o); `install_skill` (o) |
| Messaging and cards | `send_message`, `send_voice_message`, `send_image_message`, `edit_image_message`, `send_file_message`, `show_workspace_file`, `send_card`, `update_card`, `respond_to_action`, `react_to_message`, `forward_message` |
| Conversations | `conversations_list`, `conversation_read`, `conversation_message_get`, `conversation_search`, `conversation_search_result_get` (all o); `get_audio_transcript` |
| Web | `web_search`, `web_fetch` |
| Decisions | `decide` |
| Memory and recall | `memory_get`, `memory_write`, `recall`, `recall_get` |
| Scheduling | `schedule_message_create`, `schedule_message_list`, `schedule_message_cancel` (all o) |
| Sheets | `sheet_create`, `sheet_list`, `sheet_read`, `sheet_update`, `sheet_export`, `sheet_import`, `sheet_copy`, `sheet_delete`, `share_sheet` |
| Connectors | `supabase_sql`, `supabase_invoke`, `supabase_admin_sql` (o); `gmail_search`, `gmail_read`, `gmail_draft`, `gmail_send` (o); `email_*`; `bkper_*` (`bkper_post`, `bkper_check`, `bkper_trash` o) (`connections.md`) |
| Endpoints | `endpoint_invoke`, extensions-only by the platform (`connections.md`) |

There are no git, shell or browser tools on a hosted agent: the git tools
ship only in the self-hosted default, and a shell or a browser is
something you declare yourself on a self-hosted agent.

Read the live surface before tuning around a tool; the model will name
tools it does not hold:

```bash
mutiro agents tools list <agent>                    # enabled/disabled, as the agent has them
mutiro agent dev types ./<dir> --agent <agent>      # the same surface as TypeScript types
```

`tools list` marks what the checkbox does not say: `(owner-only)`,
`(owner-only, enforced by the platform)`, `(needs connection <provider>)`
for a connector not yet connected, and `(not provided by this build)` for
a tool the image declares but the binary cannot run.

To open an owner-only tool to users, `tools disable` it and then `tools
enable` it without `--owner-only`; `enable` alone never clears the mark.
Tools that cross the user boundary (`conversations_*`,
`conversation_search*`, and `bash` or `code` where declared) stay
owner-only whatever the switch says; the platform enforces it.

Removing a tool is a guardrail: "must remember not to" becomes "cannot".

### Engine knobs (environment)

- `GENIE_LLM_PROVIDER`, `GENIE_MODEL_NAME`: model selection.
- `GENIE_MAX_TOOL_RESULT_BYTES` (default 128 KiB) and
  `GENIE_MAX_TOOL_BATCH_BYTES` (512 KiB): raise both together for tools
  that return large payloads; never 0, which disables the guard.
- `GENIE_SESSION_RECORDING=full`: records the exact model input per turn
  under `.genie/sessions/`. A bounded diagnostic, never left on
  (`tuning.md`, Traces).

## Who may talk to it

An agent starts owner-only. Only users can be listed, never another agent,
and open access (`"*"`) is refused on every tier: list people instead.

```bash
mutiro agents allow <agent> <user>                  # add one person
mutiro agents deny <agent> <user>                   # remove one person
mutiro agents allowlist get <agent>
mutiro agents allowlist add|remove <agent> <user>
mutiro agents allowlist set <agent> <users...>      # replace the list; no users = owner only
```

The apps also share by username or by email invite; an invite applies
once the person signs up. Invites and billing need an app session, not a
token.

## Limits

The platform caps, per tier:

| | Free | Pro | Business |
|---|---|---|---|
| Agents | 3 | 10 | 50 |
| Hosted agents | 1 | 5 | 25 |
| People per agent | 3 | 20 | 200 |
| Active schedules | 3 | 50 | 250 |
| Shortest recurring schedule | 24 h | 1 h | 5 min |
| Active webhooks | 2 | 10 | 50 |
| Webhook deliveries per day | 100 | 2000 | 20000 |

Schedules and webhooks count against the agent **owner's** tier, even when
a developer creates them; creating or moving an agent counts against the
caller's. `--interval-every 1h` fails on Free.

## Profile and lifecycle

```bash
mutiro agents create <username> "<Display Name>" [--objective "..."] [--mood "..."] [--badge <icon>] [--from <template-dir>]
mutiro agents update-profile <agent> [--display-name] [--bio] [--avatar-url] [--badge] [--metadata k=v]
mutiro agents move <agent> hosted                   # self-hosted to hosted; keeps identity, rotates the key
mutiro agents regenerate-key <agent>                # old key stops working; new one shown once
mutiro agents delete <agent>                        # permanent; owner only
```

`--objective` generates the bio, the instructions, a voice and a
language. Voice and language change later in the apps only; the avatar is
set from the CLI by URL. Profile, sharing, delete and `move` are the
owner's. To transfer an agent to another owner, ask Mutiro.

## What the image decides

A hosted agent runs a **platform image** owned by Mutiro. The image is the
capability plane: the `mutiro` binary, pinned MCP servers, a seeded
`.mcp.json` and config template. Which image and model an agent runs is
Mutiro's to set, not the developer's: ask Mutiro. What a developer
controls on a hosted agent:

- the config plane, via `mutiro agent files push` (`tuning.md`);
- tool enable/disable and `owner_only`, via the desktop Tools tab or
  `mutiro agents tools`;
- secrets, via `mutiro agents secrets set <agent> NAME value`; they appear
  to the agent and its MCP servers as environment variables named exactly
  as set;
- connectors (Supabase, Gmail, email, Bkper), via the apps or
  `mutiro agents connections` (`connections.md`);
- published skills, which switch on with their tools (`instructions.md`).

Control-plane facts that look like bugs: a developer grant takes effect
when the agent restarts; secrets are write-only (set and delete, never
read back); the desktop Tools tab can lag the daemon's inventory, and
`mutiro agents tools list` is the ground truth; a new agent's username
gets a platform suffix and cannot be renamed.

Hosted behaviors to know: a config push lands on the agent's next wake.
Hooks reload on every call; tool extensions and skill descriptions load
at process start (`push --restart`, which discards in-flight turns); the
soul is cached per process, the manual per conversation (`/clear` or a
restart). `structure.md` has the full table. When in doubt, probe with a question
that quotes the changed line. A silent agent may be a
stopped pod, not a slow one. Files the image seeds are re-seeded on every
boot, so hand-edits to `.mcp.json` on a hosted agent do not survive.

Two timing facts that look like failures:

- A file written through the workspace API (CLI, app, an eval seed)
  reaches the pod when its mount's metadata cache expires, about a
  minute. A handler pushed and requested in the same minute falls through
  to a turn; `seed_settle_seconds` exists for this.
- A tool declared on the image but listed in `extensions_only` still shows
  as enabled in the Tools tab. That is expected: the switch is about the
  surface, the settings file about who may call it.

If a hosted agent needs a capability its image lacks (an MCP server, a
runtime), that is an image request to Mutiro, not something the config
plane can add. Anything expressible as a JavaScript/TypeScript tool over
the built-in tools (`extensions.md`) needs no image change: a whole
set of business verbs can be `.genie/tools` over `supabase_sql`.

## Contain

To stop harm fast, in rough order of reach:

- `mutiro agents stop <agent>`: nothing answers.
- `mutiro agents deny <agent> <user>`, or `mutiro agents allowlist set <agent>`
  with no users: back to owner-only.
- `mutiro agents regenerate-key <agent>`: a leaked key stops working.
- `mutiro agents webhook pause <webhook-id>`: no more inbound deliveries.
- `mutiro agents schedule pause|cancel <schedule-id>`: no more scheduled turns.
- `mutiro agents tools disable <agent> <tool>`: the capability is gone at next wake.

## Design rules that travel with the runtime

- **Honest path first.** Before writing an instruction, ask whether the
  agent has a tool that reaches the outcome. Without one it fabricates
  something that looks like the outcome and reports success.
- **Tools return measured facts.** Report what was skipped or failed
  (`skippedFiles`, `not_found`), never a summary the model must trust.
- **Judgement lives in one stage.** Deterministic reconciliation (sweeps,
  status machines, dedup) belongs in a tool, not in a prompt; every fix to
  a prompt-driven sweep is "a better sentence" until it is code.
- **Record/replay for external services.** A tool server that can write
  one fixture per exchange (`<TOOL>_RECORD_DIR`) and serve them back
  (`<TOOL>_TEST_MODE`) gives the agent an eval twin. Never record headers;
  never enable test mode on a connected production agent.
- **Two consumers on one agent conflict.** Stop a hosted or runtime agent
  before running the same agent from a shell.
