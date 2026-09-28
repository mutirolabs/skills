---
name: mutiro-agent
description: Developer guide for building and tuning Mutiro agents — the first thing to read before creating an agent, editing its instructions or skills, writing tool extensions, hooks or page handlers, running tests and evals, or deploying with the mutiro CLI. Use for any work on an agent's config repo; load the reference file the task needs.
---

# Building a Mutiro agent

A Mutiro agent is a member of the Mutiro messaging platform, hosted by
Mutiro, whose behavior is a directory of files you version in git and push
with the `mutiro` CLI. This skill is the developer's map: what the
directory is, how to make the agent capable and safe, how to test and
deploy, and how to tune it once real people talk to it. Each section
points at a reference file beside this one; read the one the task needs,
in full.

Two other sources are always current: the platform manual at
https://mutiro.com/docs/manual/index.md (plain markdown; append `.md` to
any page) and `mutiro --help` for the installed CLI.

## 0. Get the CLI and a login

```bash
curl -sSL https://mutiro.com/downloads/install.sh | bash   # macOS, Linux; MUTIRO_CHANNEL=beta by default
mutiro version
mutiro auth login <email>        # passwordless: a code arrives by email
mutiro auth whoami
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

No account yet: `mutiro auth signup <email> <username> "<display name>"`.
Working from a hosted agent or CI: mint a user token once
(`mutiro auth tokens create <name> --expires 90d`) and export it as
`MUTIRO_TOKEN`. Details: `references/runtime.md`.

## 1. Create the agent

```bash
mutiro agents create <username> "<Display Name>" --objective "<one sentence on what it is for>"
```

The platform hosts it; you get a username (`@notes_desk_x1w1`) that every
command takes. Make the repo directory for it (`<name>/`) and pull once to
see the platform's defaults:

```bash
mkdir <name> && mutiro agent files pull <username> ./<name>
```

Who it talks to, which tools are on, and the model are control-plane
settings, not files: `references/runtime.md`. Databases, connectors, APIs and
secrets, including how the Supabase roles work, how to grant them access
to your own schema, and how to register an HTTP API as an endpoint your
extensions can call: `references/connections.md`.

## 2. Know the structure before writing a line

`references/structure.md`. The directory is the **config plane** (soul,
manual, skills, tools, hooks, per-user files, shared content), synced file
by file. Beside it, never synced: `evals/` and `tests/`. Around it, never
in the repo: the runtime's state files and the **conversation workspace**
where the agent's own work lands (read it with `mutiro user workspace`).
The workspace resolves per conversation: the owner sees everything, a user
is sandboxed to `users/<x>/`. Most confusion about "where does this go"
and "why didn't my change land" dissolves with this file.

## 3. Write instructions that hold

`references/instructions.md`. Identity and voice in
`.agent_instructions.md`; rules for every conversation in
`.genie/AGENTS.md`; procedures and templates as skills; per-user rules in
`users/<x>/AGENTS.md`. Rules not guidance; names and prohibitions survive
compression verbatim; examples are copied literally so end them in
delivered work; verify by running, never by re-reading.

## 4. Extension points: make it capable, then make it safe

`references/extensions.md`. Three kinds of TypeScript run inside the
agent, bundled by the runtime with no build step:

- **Tool extensions** (`.genie/tools/<name>.ts`): a vocabulary of verbs
  over the built-in tools. Hide the raw capability with
  `extensions_only` and give the model `notes_*` instead of SQL.
- **Hooks** (`.genie/hooks/`): `beforeTool` turns a rule into a gate,
  `onMessage` and `beforeReply` shape the turn's edges.
- **Page handlers** (`handlers.ts` beside a page under `shared/`): a
  page's requests answered deterministically, without a turn.
- **`tools.decide`**, from any of the three: a typed judgment (a choice, a
  score, a yes/no) answered by System One's Jev in one call, so code can
  hold a rule that needs judgment without becoming a turn.

`examples/` is a complete small config plane covering all three, with
tests and a `dev run` for each; copy from it rather than starting blank.

Before writing an instruction, ask whether the agent has an honest path
to the outcome. Without one it will fabricate something that looks like
the outcome; the fix is a tool, not a sentence.

## 5. Test offline, then live

Offline, on the runtime's own engine with mocks, in seconds:

```bash
mutiro agent dev check ./<name>                    # everything loads as the agent will; tsc if present
mutiro agent dev test ./<name>                     # tests/**/*.test.ts, Bun-style, import "mutiro/test"
mutiro agent dev run ./<name> tool:<tool> --args '{...}' --mocks tests/mocks.ts
mutiro agent dev types ./<name> --agent <username> # mutiro.d.ts typed from the agent's real tool surface
```

Live, against the agent, on the model-facing behavior: **evals**
(`<name>/evals/*.yaml`, `references/evals.md`). A case is a prompt plus
deterministic checks on the reply, and optionally seeded files, a page
action and file checks. Every case is a real message to a real agent
with real tools: frame it, forbid the sends, use fixture users for
anything destructive.

## 6. Deploy and keep the two sides in sync

```bash
mutiro agent files push <username> ./<name> --dry-run   # read the file count
mutiro agent files push <username> ./<name>             # deploy, labeled with the repo commit
mutiro agent files pull <username> ./<name> && git diff # the agent's self-edits, as a diff
mutiro agent files mark <username> ./<name>             # after pull + commit: re-baseline
```

Push overwrites, never merges; the drift guard refuses to clobber an
agent-side edit. Tools, hooks and skills load at boot (`--restart`, or
the next wake). The discipline, traps and the hung-agent playbook:
`references/tuning.md`.

## 7. Tune from issues

`references/tuning.md`: take an issue, reproduce with a probe or eval,
diagnose (traces show what the model actually saw; self-reports are not
evidence), fix in the right layer, deploy, verify from a cleared context,
commit closing the issue, mark. A tool change gets a unit test first
(red, then green); a behavior change gets an eval that fails on the old
config and passes on the new.

## Repo-specific notes

Each agent repo carries notes on its own agents (connectors, safety,
business hours, conventions), usually as a second skill or in its
`AGENTS.md`. Read them before touching that repo's agents; they override
anything general here.
