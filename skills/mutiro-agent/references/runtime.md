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
or runtime to keep alive, and the agent is where its users are. Creating one is a desktop
or CLI action; the result is an agent username (3 to 20 chars, lowercase,
digits, underscore, with a unique suffix appended) that every command
below takes. Profile, allowlist and tool switches are server-owned:
nothing in the repo sets them.

```bash
mutiro agents create <username> "<Display Name>" --objective "<one sentence on what it is for>"
mutiro agents start <agent> | stop <agent>              # desired state of the hosted pod
mutiro agents tools list|enable|disable <agent> <tool>... [--owner-only]
mutiro agents connections providers | connect <agent> <provider>
mutiro agents secrets set <agent> NAME value            # env var for the agent and its MCP servers
mutiro agents allowlist set <agent> <users...>          # who may talk to it; "*" opens it
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

Read the live surface before tuning around a tool; the model will name
tools it does not hold:

```bash
mutiro agents tools list <agent>                    # enabled/disabled, as the agent has them
mutiro agent dev types ./<dir> --agent <agent>      # the same surface as TypeScript types
```

Removing a tool is a guardrail: "must remember not to" becomes "cannot".

### Engine knobs (environment)

- `GENIE_LLM_PROVIDER`, `GENIE_MODEL_NAME`: model selection.
- `GENIE_MAX_TOOL_RESULT_BYTES` (default 128 KiB) and
  `GENIE_MAX_TOOL_BATCH_BYTES` (512 KiB): raise both together for tools
  that return large payloads; never 0, which disables the guard.
- `GENIE_SESSION_RECORDING=full`: records the exact model input per turn
  under `.genie/sessions/`. A bounded diagnostic, never left on
  (`tuning.md`, Traces).

## What the image decides

A hosted agent runs a **fleet image** owned by Mutiro. The image is the
capability plane: the `mutiro` binary, pinned MCP servers under
`/opt/<vertical>/`, a seeded `.mcp.json` and config template. Image
pinning, model pinning and work volumes are platform-admin operations; a
developer cannot pin an image. What a developer controls on a hosted
agent:

- the config plane, via `mutiro agent files push` (`tuning.md`);
- tool enable/disable and `owner_only`, via the desktop Tools tab or
  `mutiro agents tools`;
- secrets, via `mutiro agents secrets set <agent> NAME value`; they appear
  to the agent and its MCP servers as environment variables named exactly
  as set;
- connectors (Supabase, Gmail, email), via the desktop or
  `mutiro agents connections` (`connections.md`).

Control-plane facts that look like bugs: a developer grant takes effect
when the agent restarts; secrets are write-only (set and delete, never
read back); the desktop Tools tab can lag the daemon's inventory, and
`mutiro agents tools list` is the ground truth; a new agent's username
gets a platform suffix and cannot be renamed.

Hosted behaviors to know: a config push lands on the agent's next wake.
Tools, hooks, a new skill and a changed skill description load at process
start (`push --restart`, which discards in-flight turns); the manual and
a skill's body reload without one. When in doubt, probe with a question
that quotes the changed line. A silent agent may be a
stopped pod, not a slow one. Files the image seeds are re-seeded on every
boot, so hand-edits to `.mcp.json` on a hosted agent do not survive.

Three timing facts that look like failures:

- A file written through the workspace API (CLI, app, an eval seed)
  reaches the pod when its mount's metadata cache expires, about a
  minute. A handler pushed and requested in the same minute falls through
  to a turn; `seed_settle_seconds` exists for this.
- An image or model change on an awake pod is deferred to the next cold
  start unless forced. After a deploy that involves the platform, wait
  for the new pod's first wake before probing: a fast reply may come from
  the old pod.
- A tool declared on the image but listed in `extensions_only` still shows
  as enabled in the Tools tab. That is expected: the switch is about the
  surface, the settings file about who may call it.

If a hosted agent needs a capability its image lacks (an MCP server, a
runtime), that is an image request to Mutiro, not something the config
plane can add. Anything expressible as a JavaScript/TypeScript tool over
the built-in tools (`extensions.md`) needs no image change: a whole
registry of business verbs can be `.genie/tools` over `supabase_sql`.

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
