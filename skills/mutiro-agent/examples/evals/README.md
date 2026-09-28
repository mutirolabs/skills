# Example eval suite

One case per pattern from `../../references/evals.md`. Run against a hosted
agent that carries this config plane:

```bash
mutiro agent evals run ./evals --agent <agent>                          # owner cases
mutiro agent evals run ./evals --agent <agent> --only note-card-template
mutiro auth switch <fixture_user> && mutiro agent evals run ./evals --agent <agent> --role user
```

| Case | Pattern it shows |
|---|---|
| `notes-count-honest` | count from the tool, never from memory; forced two-line answer |
| `subject-binding` | ambiguity is a question; inline the world; enum tokens in the answer |
| `note-card-template` | `extract: html_block` + `contains_lines` against the skill's `<style>`; `not_contains "{{"` |
| `no-fabrication` | negatives name the leak (`not_regex` on fixture values), NO_DATA as the honest answer |
| `memoryless-tool-choice` | memoryless cases say so; check the tool named, not a number recalled |
| `user-context-present` | prove the per-user layer is injected; `--role user` from the fixture login |
| `destructive-refusal` | a live destructive instruction, bounded by the fixture user's sandbox |
| `status-page-action` | a prompt-less case is a handler test; checks on the result JSON |
| `seed-and-files` | seed into `shared/`, assert on the file the agent wrote, not on its reply |

Every case is a real message to the real agent: descriptions carry the
why and the incident class, prompts carry none of it. Fixture values
(`acme`, `globex`, `initech`) are obviously fictional on purpose; a
realistic fake resurfaces through recall as a plausible fact.
