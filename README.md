# Mutiro public skills

Portable instructions for Supabase, Bkper, Gmail, and agent email workflows.
Each folder under `skills/` contains a standard `SKILL.md` and any supporting
resources. Use it with a harness that provides the tools described by the skill.

Mutiro-specific registration, discovery descriptions, tool requirements, and
activation rules live in the Mutiro codebase. This repository contains public
skill content; non-public and always-available core skills remain bundled with
Mutiro. Skills do not configure credentials, grant tools, or change permissions.

## Supabase and Bkper workflows

| Skill | Tool surface and boundary |
| --- | --- |
| `supabase-data` | `supabase_sql`: query, insert, update, delete, and export rows using the agent's `_data` role. |
| `supabase-schema` | `supabase_admin_sql`: schema changes and migration data operations using `_schema`; owner-only by default. |
| `bkper-bookkeeping` | `bkper_books`, `bkper_accounts`, `bkper_transactions`, `bkper_balances`, `bkper_record`: read the bound ledger and capture drafts with existing accounts. |
| `bkper-review` | The four Bkper read tools plus `bkper_post`, `bkper_check`, `bkper_trash`: transaction lifecycle changes, owner-only by default and configurable by the owner. |

Supabase isolates agents by schema, not conversations by row. Both connection
roles bypass RLS. Bkper has no account/group structure editing or transaction
field editing tools in Mutiro. The skills describe these boundaries; runtime
and provider permissions enforce access. Each workflow is advertised only when
all of its required tools are available to the current sender; disabling one
hides that workflow without changing the underlying tools' permissions.

The two Bkper skills adapt [Bkper's published skill](https://github.com/bkper/bkper-cli/tree/main/skill).
Each includes its source revision, adaptation notice, and Apache-2.0 license.

## Authoring

Add or edit `skills/<name>/SKILL.md` with YAML `name` and `description` fields.
Names use lowercase letters, digits, and hyphens and match their directory.
Keep guidance focused on the task and existing tool contract. Put supporting
resources inside the same folder. Do not add `mutiro.*` metadata or depend on
another skill being installed.

Validate and package locally:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install PyYAML==6.0.2
.venv/bin/python scripts/package.py --output dist
```

## Publishing

After merging reviewed content into `main`, push a new stable tag such as
`v0.1.0`. The workflow validates the content, builds one ZIP per skill, uploads
all assets to a draft release, then publishes it as latest. Published tags and
assets stay fixed; corrections get another version. Failed publication leaves
latest unchanged; remove a failed draft before retrying that unpublished tag.

Each ZIP has `SKILL.md` at its root. For example:

```text
https://github.com/mutirolabs/skills/releases/latest/download/supabase-data.zip
https://github.com/mutirolabs/skills/releases/download/v0.1.0/supabase-data.zip
```

There is no remote catalog or whole-repository bundle. Adding a skill to Mutiro's
available catalog requires a registration in Mutiro; updating the instructions
of an existing registered skill only requires a skills release. Keep content
compatible with the tool contracts it targets.

## Mutiro loading

Agent startup and skill listing perform no public-skill HTTP requests or cache
validation. Mutiro downloads an eligible skill ZIP only on first use and checks
for an update at most once per used skill per daemon lifetime. Subsequent loads
share that complete copy. A failed update uses a validated cached copy; with no
cache, only that skill request fails. Restart permits another attempt.

`MUTIRO_SKILLS_RELEASE` selects `latest` (default), a stable tag, or `off`.
Pinned cached skills work without an update request. Cached copies are visible
under Agent → Published Skills. Owners customize using their ordinary skill
installs, which take precedence and are never overwritten automatically; they
can disable names in `.genie/skills/settings.yaml`.
