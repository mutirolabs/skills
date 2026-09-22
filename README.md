# Skills

Skills for working with Supabase, Bkper, Gmail, and email. Each skill contains
instructions and reference material that an agent can load for a relevant task.

## Available skills

| Skill | What it helps with |
| --- | --- |
| [supabase-data](skills/supabase-data/SKILL.md) | Query, update, and export database records. |
| [supabase-schema](skills/supabase-schema/SKILL.md) | Create and migrate tables, indexes, views, and functions. |
| [bkper](skills/bkper/SKILL.md) | Explore ledgers, prepare financial reports and tax worksheets, and record draft transactions. |
| [bkper-review](skills/bkper-review/SKILL.md) | Post drafts, reconcile transactions, and trash or recover entries. |
| [gmail](skills/gmail/SKILL.md) | Search and read Gmail, prepare drafts, and send messages. |
| [mail](skills/mail/SKILL.md) | Read the agent's inbox, retrieve attachments, and send or reply to email. |

## Using a skill

Choose a skill and install its folder using your agent's skill installer, or
copy it into the directory your agent uses for skills. Keep the entire folder,
including any reference files. Each `SKILL.md` describes the tools and setup
that its instructions expect; your agent needs compatible tools to use it.

For a versioned copy, use the individual skill ZIPs attached to
[releases](https://github.com/mutirolabs/skills/releases). Each ZIP contains
`SKILL.md` at its root along with the skill's supporting files.

## Contributing

Add or edit `skills/<name>/SKILL.md` with YAML `name` and `description` fields.
Use lowercase letters, digits, and hyphens for names, matching the folder name.
Explain when the skill applies, keep instructions focused on the task, and
include any supporting references in the same folder.

Validate and package the skills locally:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install PyYAML==6.0.2
.venv/bin/python scripts/package.py --output dist
```

Maintainers publish a release by tagging reviewed content with a stable version
such as `v0.1.0`. The release workflow validates and packages each skill into its
own ZIP. Corrections receive a new version.

## Attribution

The Bkper skills adapt [Bkper's published skill](https://github.com/bkper/bkper-cli/tree/main/skill),
including its core concepts and reporting guidance. Each includes the source
revision, adaptation notice, and Apache-2.0 license.
