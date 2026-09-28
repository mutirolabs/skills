# Tuning loop: issue → reproduce → edit → deploy → verify → close

The loop: **take an issue → reproduce → diagnose → pull → edit in the repo →
push (deploy) → verify → iterate → commit closing the issue → mark**.

## The commands

```bash
mutiro agent files list <agent>              # manifest + hashes; drift is annotated
mutiro agent files pull <agent> ./<dir>      # agent edits → working-tree diff
mutiro agent files push <agent> ./<dir>      # deploy; --dry-run first; --restart kills live turns
mutiro agent files mark <agent> ./<dir>      # relabel + re-baseline hashes after pull+commit
mutiro user conversation clear <agent>       # clear agent context in YOUR conversation
mutiro agent conversation clear <agent> <user>   # ...in the agent's conversation with a user
mutiro agent evals run ./<dir>/evals --agent <agent> [--only <case>] [--role user] [--in-conversation-with <user>]
mutiro user message send <agent> "..." --wait --wait-timeout 300   # cold start takes minutes
mutiro user workspace ls [-R]|cat|preview <agent> <path>   # read what the agent produced; never wakes it
mutiro user message action <agent> <action> '<json>' --source <page> --wait   # a page's request, without a browser
mutiro agent message read <user> --view-as <agent>   # read-only supervision
```

## Running the loop as a developer, or from a token

Every command above accepts **developer standing**: an owner grants it
with `mutiro agents developers`, and hosting, secrets, and view-as reads
all admit a granted developer. The one exception is
`mutiro agent conversation clear <agent> <user>` — writing into another
user's conversation as the agent stays owner-only.

The loop also runs without a login. Mint a **user token** once
(`mutiro auth tokens create <name> --expires 90d`, from a logged-in
session) and export it as `MUTIRO_TOKEN`; every command then acts as you,
with your developer grants. This is how a hosted agent or a CI job runs
the loop. A token cannot mint tokens, create agents, or delete the
account, and a malformed `MUTIRO_TOKEN` fails closed rather than falling
back to a stored login.

## Diagnosing before editing

- **A cold start is usually about twenty seconds on the default image,
  sometimes much longer** (a heavier image, a first pull). Waiting costs
  nothing, so probe an idle agent with `--wait-timeout 300`; a shorter
  wait once gave up during a slow boot and looked like silence. Queued
  messages are consumed in one backlog turn whose single reply threads to
  the newest message. Read the logs before restarting: a restart kills
  the queue you are waiting on.
- **Escape hatches mean a broken tool.** When the agent stops using the
  tool you expect and reaches for file operations or workarounds, suspect
  the tool, not the prose; read the trace for the tool's error first.
- **Judge a live action by the sent artifact.** The agent's summary to
  the desk labeled a margined price as "cost"; the email was right. Read
  the outbound message in the workspace, not the report about it.
- **Decompose autonomy by blast radius.** One issue per step, saying what
  and not how; take first the step that removes a round-trip while every
  output still lands with a human. A single big flip moves a dozen evals
  at once and cannot be verified red/green.
- **Real traffic beats a synthetic suite.** Evals are the seatbelt; when a
  behavior is deployed, let the real users run it before iterating on
  burner scenarios.

- **A matching answer is not proof of the path.** After deploying a tool
  that shadows an old one, prove which ran from a side-effect counter or
  the tool trace, not from the reply: extensions failed silently while
  the model answered from the old tools and every number still matched.
- **Verify a bulk write-back per record, in the store.** Two of
  thirty-three "closed" replies had no write behind them.
- **Measure churn before tuning it**: count tool calls per tool per turn
  from traces, then fix the largest bucket. Never add rules against a
  churn that belongs to the eval prompt or the platform.

## Deploy discipline

`push` overwrites file by file — no merge. The drift guard rejects a push
that would rewrite a file edited on the agent since the last deploy, but
the habit stays: **pull → review the diff → commit → then push.** Agents
that record lessons in their own files self-edit constantly; agent-side
changes are the normal case, not an exception.

- Read the file count the push prints. More files than you changed means
  you are about to overwrite someone's work. `--dry-run` shows it free.
- `pull` does **not** clear the drift flag — the marker still holds the
  old hashes. After pull + commit, run `mark`; only then is push clean.
- "Nothing to push" skips the marker — that is what `mark` is for.

## After a platform or CLI upgrade

- `mutiro agent dev check` and `test` refresh `mutiro.d.ts` when the CLI
  version changes; `dev types --agent` is the one to rerun by hand after
  the agent's surface changes (a tool enabled, an image bump). Nobody does
  it for you, and a stale file only costs editor accuracy, so the habit is
  cheap: rerun it when a type error names a tool you know exists.
- A hosted agent reports tool schemas only after its first engine build on
  the current fleet build. If `dev types --agent` comes back with every
  tool untyped, wake the agent once (any message) and rerun.
- The examples' first `dev run` of a hook failed with "Object has no
  member 'notes_list'": in `dev run` and `dev test` the mocks are the
  whole tool surface, so a hook that calls your own extension needs it
  mocked too.

## Stopping, waking, hung agents

- Killing the *sender* (eval runner, script) stops nothing: delivered
  messages keep processing. Only a pod restart stops execution
  (`files push --restart`, or an image re-pin `--force`) — and it
  silently discards in-flight turns, including queued messages.
- A silent agent may be a dead pod, not a slow one. Ping it; if a
  trivially cheap question hangs for minutes, restart. Messages that were
  queued die with the pod — re-send them.
- Config pushes land on the next wake. Tools, hooks, a new skill and a
  changed skill description need a fresh pod; the manual reloads per
  conversation and a skill body on invocation. Verify with a probe that
  quotes the changed lines before concluding a fix failed.
- **Deploy is not done when git is.** A skipped push produced an
  old-layout email under a confident "I used the new template": the
  agent's self-report tracks the instruction it received, not the files
  deployed. `files list` shows the hash that landed.
- **Roll a new tool surface out dark.** `owner_only` first, exercise it
  from the owner seat (including migrating old data through it), then
  open it to users together with the instruction change.

## Another user's conversation

Reading is fine: `mutiro agent message read <user> --view-as <agent>`.
**Writing is not** — a message sent there appears as *you*, inside a live
conversation the user is sitting in (`--in-conversation-with` does this
too; reserve it for fixture users and service members). Act from your own owner
conversation instead (the agent reaches every user workspace from
there), or leave the user's own agent a one-shot: write
`users/<user>/ONEOF_AGENTS.md` (via the agent — it is not in the
syncable set); it is injected on that user's next turn, then deleted.

## The owner conversation is a tuning surface

A lot of tuning is not file sync at all: you converse with the agent and
it edits its own `.genie/AGENTS.md`, per-user files, and workspaces —
distilling session lessons into rules, cleaning an author's folder,
placing one-shots. Treat those sessions as deploys in reverse: when done,
`pull` → review → commit → `mark`, or the next push destroys them.

## What the agent did, per message

Conversation reads return messages, never tool calls. The owner-only
tool `conversation_message_get` returns an activity digest per message
(`tool`, `args`, `summary`, `success`), so an audit of "did the action
behind this claim happen" is a read of that digest, not a trace. CLI
supervision reads (`message read --view-as`) return roughly the latest
fifty messages whatever `--limit` says; deeper history is the agent's own
`recall` and `conversation_read`. Two days of fabricated "routine
executed" replies looked healthy in every conversation read; the digest
is where they show.

An incident class is closed at three layers: a tool refusal, a manual
rule, and a regression eval. Any one alone reopens it.

## Traces (what the model actually had in front of it)

Self-reports are not evidence: an agent will say it loaded a skill it did
not, and report files it never read. The genie session trace is the record
of the real model input. Turn it on as a secret, run the turns, turn it
off; it is a bounded diagnostic, never left on:

```bash
mutiro agents secrets set <agent> GENIE_SESSION_RECORDING full   # applies at the next cold start
# ...run the turns...
mutiro agents secrets delete <agent> GENIE_SESSION_RECORDING
```

The session files land under `.genie/sessions/` in the agent's state,
outside the workspace and the syncable set, so a hosted developer asks
Mutiro for them; on a local burner they are on disk, readable with
`genie sessions show <file> [--turn N]`. For most questions the activity
digest above answers faster and without recording.

## Logs

Pod logs of a hosted agent are Mutiro's; a developer reads outcomes
through the platform: the reply, the activity digest, `mutiro agents tools
list`, `mutiro user workspace`, and the deploy marker in `files list`. A
stopped agent logs nothing anywhere, so the absence of a wake is not
evidence of a dropped message: ping it.

## Safety

- Know the agent's live connectors before probing (each repo's notes say;
  e.g. a live email connector means any probe that could read as a send
  instruction must forbid sending, explicitly, in the probe).
- Probes land in real conversations and enter history/memory. Keep them
  test-framed. There is no burner: tuning happens by talking to the live
  agent, with fixture users bounding anything destructive.
- `--view-as` is read-only by design. Owner-mode sends are always as you.
- Runtime wiring (pins, connectors, secrets) is control plane — never
  committed. **Never commit secrets.**
