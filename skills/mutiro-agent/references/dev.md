# Checking code offline: `mutiro agent dev`

The loop for tool extensions, hooks and page handlers (`extensions.md`)
before they reach the agent: load them as the runtime will, run one
target with mocks, run the unit tests, and type them against the agent's
real tool surface. Everything here runs on the runtime's own engine, in
seconds, with nothing deployed. The model-facing behavior is checked live
with evals (`evals.md`).

## Commands

```bash
mutiro agent dev check ./<dir>     # load everything as the agent will; tsc --noEmit if tsconfig + tsc exist
mutiro agent dev test ./<dir>      # run tests/**/*.test.ts and *.test.js; --only <text>
mutiro agent dev run ./<dir> tool:notes_list --args '{"subject":"acme"}' --mocks tests/mocks.ts
mutiro agent dev run ./<dir> hook:beforeTool --call notes_add --args '{"subject":"acme","text":"  Prefers email  "}' --mocks tests/mocks.ts
mutiro agent dev run ./<dir> handler:shared/status:loadStatus --payload '{}' --mocks tests/mocks.ts
mutiro agent dev types ./<dir> --agent <agent>   # mutiro.d.ts + tsconfig.json for the editor and tsc
```

`check` prints each entry with the files it bundles and every error as the
agent would report it at boot; run it before every push. `run` executes
one target on the runtime's engine with mocks and prints the decision, the
dependency calls in order, and console output. `--role user` and
`--username` set the caller.

## Types

`mutiro.d.ts` is where the signatures used in `extensions.md` come from. It
declares, without an import: `Tools` (the caller's tool surface),
`ToolDefinition`, `ToolRun`, `ExtensionContext`, the hook types
`OnMessage`, `BeforeTool`, `BeforeReply`, the page type
`Handler<Payload>`, and `MessagePayload`/`MessagePart`. It also types the
two virtual modules: `"mutiro"` (`ValidationError`, `Handoff`) and
`"mutiro/test"` (`describe`, `it`, `expect`, `tool`, `hook`, `handler`,
mocks). Annotate every export with its type (`export const beforeTool:
BeforeTool = …`) so the editor and `tsc` check the shape the runtime
calls.

`mutiro.d.ts` is generated, stamped with the CLI version and refreshed by
`check` and `test` after an upgrade; keep it out of version control
(`.gitignore`) and commit `tsconfig.json`. Without `--agent` the `Tools`
interface types your own extensions from their `inputSchema` and leaves
other names open. With `--agent <username>` it fetches the hosted agent's
enabled tools with their schemas and closes the interface, which makes it
the reference for what the agent can call: a tool the
agent does not have is a type error, and each built-in tool's arguments
are typed. Regenerate after adding a tool or after the agent's surface
changes; the platform does not do it for you, and a hosted agent reports
schemas only after it has run once on its current build.

## Tests

Tests live in `tests/`, a sibling of `.genie`, so they never sync to the
agent. They are TypeScript on the same engine, Bun-style:

```ts
import { describe, it, expect, tool, hook, handler } from "mutiro/test";
import { notesStore } from "./mocks";   // a fake answering the SQL the tools issue

describe("notes_add", () => {
  it("refuses an empty subject and writes nothing", () => {
    const store = notesStore();
    const r = tool("notes_add").run({ subject: "  ", text: "x y z" }, { tools: store.tools });
    expect(r.validation).toContain("subject is empty");
    expect(store.notes).toHaveLength(0);
  });
});
```

- `tool(name).run(args, { tools, context })`, `hook(name).run(input, { tools, call })`,
  `handler(pageDir, action).run(payload, { tools })` run the real code with
  mocks and return `{ kind, result, validation, failure, handoff, skip,
  reply, refusal, args, text, parts, calls, logs }`. `calls` is the ordered list of
  dependency calls with arguments and what the mock answered: assert on it
  to pin *how* a tool worked, not only what it returned.
- Mocks are plain functions from arguments to result; throw to make the
  tool report an error. A dependency with no mock is a failure naming the
  tool.
- A fake of the backing store pays off fast: the examples' `tests/mocks.ts`
  matches SQL by shape and records writes, so every tool test is a few
  lines. A new statement in a tool needs a matching clause there.
- Matchers: `toBe, toEqual, toMatchObject, toContain, toMatch, toBeTruthy,
  toBeFalsy, toBeDefined, toBeUndefined, toBeNull, toHaveLength,
  toBeGreaterThan(OrEqual), toBeLessThan(OrEqual), toThrow`, and `.not`.
- Tests are synchronous; there is no `async` in the engine.

A tool change gets a test in the same commit. Fixing a live misbehavior
starts with a failing test that reproduces it (red), then the fix (green),
then a push; the eval (`evals.md`) guards the model-facing side of the
same change.

## Lessons from converting a tool set

- **Convert with the metadata byte-identical.** A refactor that also
  reworded a description changes model behavior in the same commit as the
  code change; when the evals then move, you cannot tell which did it.
  Diff the `tool` exports before and after.
- **A red test first, even for a "simple" lookup.** Writing the fixture
  is where the edge case the old code gets wrong shows up; the test fails
  on the old code, then passes on the new. A test written after the fix
  encodes whatever the fix does, bug included.
- **The fake store answers by shape, so its clauses order matters.** Put
  the most specific SQL match first; an unmatched statement must throw,
  never return empty rows, or a new tool query silently tests nothing.
- **Compare dates by day, not by instant**, when a tool reconciles an
  external feed against the store: two representations of the same day
  (with and without a time) read as a change every sync otherwise.
- **Sort before asserting on order the source does not promise.** Lists
  that come back from the platform or an external API in no fixed order
  make an order-sensitive test flaky.

## Conventions worth copying

- `tsconfig.json` at the agent root, `include` covering `mutiro.d.ts`,
  `.genie/tools/**/*.ts`, `.genie/hooks/**/*.ts`, `shared/**/*.ts`,
  `tests/**/*.ts`; `"types": []` so Node types do not leak in.
- `.prettierrc` with a wide `printWidth` (140): tool descriptions and SQL
  read better on one line.
- One tool per file, named for the tool; shared code in `lib/`; a
  `groupTool` style helper for the repeated metadata; comments say why,
  not what.
