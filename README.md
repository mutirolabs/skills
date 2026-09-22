# Mutiro skills

Skills for agents working with Mutiro's tools. Each skill provides task-specific
instructions, examples, and reference material to help an agent use those tools
effectively.

## Using the skills

Browse the [skills directory](skills/) and choose the skills relevant to your
agent. Each folder contains a `SKILL.md` describing its purpose, expected tools,
and instructions, along with any supporting resources.

Install a skill using your agent's skill installer, or copy its entire folder
into your agent's skills directory. Keep the supporting files with `SKILL.md`.
For versioned copies, download individual skill ZIPs from
[releases](https://github.com/mutirolabs/skills/releases).

If your agent supports installing skills from URLs, you can ask it directly.
For example:

```text
Install the Bkper skill from:
https://github.com/mutirolabs/skills/releases/latest/download/bkper.zip

Include its supporting reference files, and use it when working with my
Bkper books: querying transactions, preparing reports, and recording drafts.
```

Use these URL patterns for any skill:

```text
Latest release:
https://github.com/mutirolabs/skills/releases/latest/download/<skill-name>.zip

Specific version:
https://github.com/mutirolabs/skills/releases/download/<version>/<skill-name>.zip
```

Replace `<skill-name>` with the skill's folder name and `<version>` with a
published tag, such as `v0.1.0`. These URLs become available when the
corresponding release assets are published.

These skills expect the Mutiro tools described in their instructions. They can
also be used with other agent environments that provide compatible tools.
Installing a skill supplies guidance; the tools and their connections must
already be available in your environment.

## Contributing

Add or edit `skills/<name>/SKILL.md` with YAML `name` and `description` fields.
Use lowercase letters, digits, and hyphens for names, matching the folder name.
Explain when the skill applies, keep instructions focused on using the relevant
tools, and include supporting references in the same folder.

Validate and package the skills locally:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install PyYAML==6.0.2
.venv/bin/python scripts/package.py --output dist
```

Maintainers publish reviewed content by tagging a stable version such as
`v0.1.0`. The release workflow validates and packages each skill into its own ZIP.

## Attribution

Skills adapted from other projects include source attribution and applicable
license notices in their folders. Preserve those notices when reusing or
modifying the material.
