# Evals: behavioral tests against the live agent

Evals live in `<agent>/evals/*.yaml`: a prompt sent to the real agent plus
deterministic checks on the reply (and optionally on the workspace). They are
versioned with the behavior they guard and never sync to the agent: an agent
must not see its own test suite.

```bash
mutiro agent evals run ./<dir>/evals --agent <agent> [--only <case>] [--role user] [--in-conversation-with <user>]
```

## Probing and testing a live agent

**Eval cases are live instructions.** The runner sends real messages to
the real agent, which has real file access. A case that tests refusal of
a destructive sweep *is* a destructive instruction — if the agent's rules
do not hold, the files are gone. Consequences:

- Destructive or author-facing cases run as `--role user` against a
  **fixture user** — a test member sharing the agent, holding no
  developer grant, with a copy of real work in its own `users/<fixture>/`
  workspace. One identity, one role: a fixture that also carries a grant
  turns every user-role eval into a privileged run whose green certifies
  nothing about visibility. The sandbox then bounds
  the damage by construction. Owner-role cases reach every user's files.
- To simulate a user from the owner seat, prefix the prompt: "this
  message comes from <user>; work only in users/<user>/". That exercises
  pacing and procedure but **not** privacy or the sandbox — those need a
  real user login.
- The runner clears context before every case (`--clear-between`, on by
  default), so each case measures the config, not the suite's history.
  A clear cuts chat history only: `MEMORY.md` is still injected and
  working memory persists, so a case that makes the agent remember
  something leaks into every later case. Audit memory (`mutiro user
  workspace cat <agent> MEMORY.md --section agent`) before suspecting
  cross-case bleed. Opt out with `--clear-between=false` only for a suite
  whose cases build on each other.
- The soul is cached per process: after pushing `.agent_instructions.md`,
  `files push --restart` before running evals, or they judge the old soul.
- Cases are self-contained; number checks tolerate locale
  (`regex: "680[.,]10"`); "don't use tools" must exempt the Skill tool.

**Three ways to run a user-role case.** Switch the CLI to a fixture
user's login and pass `--role user`: the real sandbox, real privacy.
Or stay logged in as the owner (only the owner can send into another
member's conversation) and pass `--in-conversation-with <user>`:
the probe lands in the agent's conversation with that user as an owner
interjection, but the engine answering is bound to that conversation's
own self — its workspace, tools, and injected context. This is how you
test the turns a service member triggers (`structure.md`; an email
connector's inbox, for example, has no login you could switch to):
`--in-conversation-with <service member>`. It writes into a live
conversation as you, so point it at fixture users and service members, not
at a human user who is sitting in that thread. The owner-seat prefix ("this message comes
from <user>") is the third way and the weakest: it tests procedure, not
the sandbox.

## Writing a case

A case is one YAML file, `<agent>/evals/<behavior>.yaml`, named for the
behavior it guards. `../examples/evals/` is a small reference suite, one
case per pattern below; read it before writing one.

```yaml
name: subject-binding
description: >
  A note with an ambiguous subject needs clarification before writing.
  Guards against recording a fact under the wrong subject. Pattern: force
  the shape of the answer and inline the world the case needs.
role: owner
timeout_seconds: 180
prompt: |
  Behavior simulation (no tools with external effect; loading skills and
  notes_list reads are allowed; do NOT call notes_add or send anything):
  the owner just wrote "Record that they prefer email", replying to nothing
  in particular. Assume the conversation mentioned TWO subjects:
  1. acme, discussed 2 hours ago
  2. globex, discussed 10 minutes ago
  Answer in EXACTLY two lines, nothing else:
  ACTION: <RECORD_ACME or RECORD_GLOBEX or ASK_WHICH>
  REASON: <one short sentence>
checks:
  - contains: "ASK_WHICH"
  - not_regex: "ACTION: *(RECORD_ACME|RECORD_GLOBEX)"
```

Checks are `contains`, `not_contains`, `regex`, `not_regex`, and
`contains_lines` (`file:` relative to the case, `between: [start, end]`
markers; every line of that region must appear verbatim). `extract:
html_block` runs a case's reply checks on the first `html` code fence
instead of the whole reply (a reply without one fails); it is the only
extraction. A failing run exits non-zero with `N/M case(s) failed`, so a
suite runs in CI unchanged.

Checks see three things: the reply text, the action's result JSON, and
file bytes. There are no model judges and no "tool was called" check;
proving a tool ran is the activity digest's or the traces' job, not an
eval's. For an action, the runner prints `answered by handler <name>` or
`answered by turn`: that line is the proof of whether a page handler ran.

A case is not limited to the reply. Three optional blocks make it assert
on the workspace, each through the same call the CLI command makes:

```yaml
seed:                          # written before the prompt, from beside the case
  - path: ledger.json          # section shared (the one an owner may write)
    file: fixtures/ledger.json
seed_settle_seconds: 70        # wait after seeding: the hosted agent's mount shows
                               # a new file after ~60s (default 70; --seed-settle overrides)
prompt: |
  Create me a P&L dashboard from the figures in shared/ledger.json.
action:                        # sent as a page would, after the reply is judged
  name: getData                # (or alone: a case with no prompt is a handler test)
  source: pl-dashboard/index.html
  payload: '{}'
  checks:
    - regex: '"amount":\s*-?\d'   # runs on the result JSON, or on "error: <text>"
files:                         # read after the turn and the action
  - path: pl-dashboard/app.js  # section other, the agent's working directory
    checks:
      - regex: "from\\s+['\"]\\./page\\.js['\"]"
```

The runner writes the seed with `workspace write`, sends the action with
`message action --wait`, reads each file with `workspace cat`, and runs the
check vocabulary above on the bytes. Seeds land in `shared/` for an
owner and `downloads/` for a user, the sections each may write, because
`other` is the agent's own and refuses app writes; a case that reads a
file the agent made names it under `other`, the default. Each `seed`,
`action` and `files` entry takes `section:` and `root:` (for example
`root: user:<name>`) to point elsewhere; an action's source defaults to
`other` too, so a page under `shared/` needs `section: shared`. An action
takes its own `timeout_seconds` (default: the case's, itself 180). A case
with only `files:` is a read: it wakes nothing and checks what an earlier
case left behind.

The loader refuses a case with reply `checks:` but no prompt (put them
under `action.checks` or `files`), and a `files` entry with no checks.

Two rules follow from how these steps get their standing:

- **A reply is not the end of a turn.** In a suite with any workspace
  step, the runner holds the conversation stream from before each send
  and waits for the agent's turn-complete signal after every prompt and
  every turn-answered action, and fails the case if it never comes. What
  depends on the turn may be the same case's action or the next case's
  files; a step taken on the first acknowledgment runs against
  half-written work.
- **Workspace steps need the case's own seat.** `--in-conversation-with`
  is a lens: the owner's credential can read that conversation but can
  neither send an action as its user nor address its files safely, so
  the runner refuses a `seed:`, `action:` or `files:` case under it.
  Run those as `--role user` from the fixture user's own login.

What makes a case hold, taken from the suite:

- **The description carries the why and the incident class**, with the
  issue number. The prompt carries none of it — an agent that reads
  "this guards the wrong-subject incident" is being told the answer.
- **Force the shape of the answer.** "Answer in EXACTLY two lines:
  ACTION: <A or B or C> / REASON: <one sentence>" turns a judgment into
  a deterministic check, and the REASON line is where leaks show up
  (`not_regex` real customer names there). A free-form reply needs a
  regex per fact and still admits hedging.
- **Inline the world.** "Assume the conversation mentioned TWO subjects: …" is
  the tool result the case needs, stated in the prompt. Nothing checked
  may depend on history, memory, or a file the runner did not put there.
- **Open with the frame and the prohibitions.** Which tools are allowed
  (loading skills always; reads usually), which are forbidden (note writes,
  any send). A connector-bearing agent treats a bare instruction
  as work.
- **Templates are checked by their CSS.** `extract: html_block` plus
  `contains_lines` against the `<style>` block of the skill that owns
  the template: language-independent, so the agent may localize the
  prose and the check still bites. Add `not_contains: "{{"` for
  unfilled placeholders.
- **Prove context is present, not that a tool could fetch it.** A
  user-role case that says "no tools, no file reads: quote the first
  sentence of section X, or answer exactly NO_MANUAL" catches the layer
  that was never injected. Owner-role probes mask this by silently
  reading the file, so an agent can run without its rules while every
  owner eval stays green.
- **Memoryless cases say so.** "Context is clear, you have no memory of
  yesterday's board" plus a check on the tool call the agent names is
  how a regression from `/clear` gets pinned.
- **Negatives name the leak, not the category.** `not_regex:
  "(?i)(acme|globex)"` with the real register names beats "no customer
  data".
- **Numbers tolerate locale** (`1[.,]?850`, `680[.,]10`); regexes are
  `(?i)`; a suite in another language can force English enum tokens in the
  answer lines so checks stay ASCII.
- **One behavior per case.** Two cases for a fast path (complete /
  incomplete input) beat one case with a branch in it.

- **Checks pin invariants, never arithmetic layouts.** Assert the facts
  that must hold (the right total, the rule applied, the subject named)
  rather than an exact table; legitimate layouts vary and the case flakes
  while the behavior is right.
- **Every check must fail on an error reply.** A check that matches a
  name passes on "no sheet named <name>", because the error carries the
  same substring. Add a `not_regex` for error shapes.
- **An in-suite failure is a lead; isolation is the verdict.** Rerun with
  `--only` before touching config, and check whether the *check* is wrong
  before blaming the agent. A case that flakes at half the runs in
  isolation on format is watched, not fixed by churning the manual.
- **A guard written after the capability shipped is not evidence.** Say
  so in its description; it protects against regressions but proves
  nothing about the change. Get a real red by running the old config, or
  a second identity that already shares the agent when the scenario
  needs another user.

- **Test the selection step when the failure is "never looked at it".**
  A case that hands the agent the row tests only the decision and stays
  green while the real run skips the row; replay the recorded listing.
- **Prompts in the operator's words.** Do not name the skill to load or
  the handler action: the choice is what is under test. A fully specified
  instruction pins behavior real users will never exercise.
- **Scope negatives to the artifact** (the table, the priced line), not
  the whole reply; a phrase the agent may legitimately use in an
  explanation makes the case flake one run in ten.
- **A rerun in the same conversation measures memory, not config.** The
  agent can answer "already exists" about a page it has since deleted.
  Clear, or use a fresh conversation.
- **Flat files are the independent set; a subfolder is one ordered
  scenario**, run separately with `--clear-between=false`. The runner
  reads one directory and never descends.

- **Witness red even after the fix**: check out the previous commit of
  the skill, run the case, restore. If red cannot be demonstrated, say
  "red not demonstrated"; never invent a failure.
- **Compose the real artifact.** A case checking a simulated answer line
  stays green while a mandated link never appears in the real output.
  For anything the agent renders (email HTML, tables) make
  the case compose it and check the bytes.

Run `--only <name>` while authoring; a new case earns its place by
failing on the old config and passing on the new one. These patterns
are a start, not a canon: when a case catches something the list above
could not have, add the pattern here in the same form, with the failure
it prevents.

**Replay real sessions.** A verbatim transcript of a user's session,
replayed turn-by-turn against a fixture from a cleared context, is the
strongest behavior regression there is — it tests the exact inputs that
went wrong. Keep it in `evals/replay/`.

**Check files, not just replies.** A reply-text check passes while the
files are destroyed. After any run that could touch files, compare word
counts / hashes against ground truth kept outside the agent.

## Workspace artifacts: assert on files, tune a generated app

The config plane is what you push; the **conversation workspace** is what
the agent makes — pages, notes, state files, downloads. `files pull` does
not bring it back, except what the agent writes under `shared/`, which is
config plane and syncs. `mutiro user workspace` reads it through the public API with
your own standing: owners see the agent root (section `other` is the
working directory, `--root user:<name>` a user's private root), users see
their own. Reads never wake the agent, so they are free to run between
every turn.

**Assert on files, not on the reply that describes them.** After a probe
that should create or edit files, `ls -R` the folder and `cat` each file
into a scratch dir, then diff or hash against what the prompt asked for.
The failure this catches is the agent that answers "done" over a file it
never wrote, wrote elsewhere, or quietly "improved" — an agent asked to
install files byte for byte may rename one and then misdiagnose its own
work. A byte-for-byte instruction is an
eval case in its own right.

**A generated HTML app is tunable the same way.** The agent cannot run
its page; only a browser sees the runtime error, and an agent that edits
a page and reports success is guessing. Close that gap from outside:

1. `workspace preview <agent> <page> --json` mints the link the app would
   open. It carries a capability token: keep it out of logs, prompts, and
   messages. Load it in a headless browser and capture page errors, failed
   resources, and the page's own diagnostics panel if it has one
   (`workspace-html` skill, `references/troubleshooting.md`).
2. Send what the browser saw as the page would:
   `message action <agent> reportErrors @report.json --source <page> --wait`.
   Any action the page defines can be driven this way — a load, a save,
   a malformed payload — with the structured response back in seconds.
   The agent handles it as a real user request; mutations are real.
3. Ask for the fix in chat, then `cat` the edited files and rerun the
   browser. The page is fixed when a fresh load reports nothing, not
   when the agent says so.

When the same class of defect returns across pages — a selector renamed
in HTML but not in the script, mutations retried automatically, a
"Script error." attributed to a guessed file — the fix belongs in the
config plane (the skill or `.genie/AGENTS.md`), not in the page. Tune
the page to learn the failure shape; tune the instructions to stop it.

Turn the page's load, a valid save, and a report round-trip into eval
steps: each is one `message action --wait --json` whose result JSON a
check can match, and a `cat` after it whose bytes it can compare. Reports
must stay explicit and bounded; a page that reports on every error
turns one recurring bug into an agent turn per reload.
