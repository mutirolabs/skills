# Bkper attribution

These instructions include material adapted from the Bkper CLI skill:
https://github.com/bkper/bkper-cli/tree/1f7f638f754d7e0d984d965cf8f5f4c19582d5e6/skill

Source revision: `1f7f638f754d7e0d984d965cf8f5f4c19582d5e6`.
Source documents: `SKILL.md`, `references/core/core-concepts.md`,
`references/cli/data-management.md`, and
`references/reporting/financial-statements.md`.

Bkper distributes that material under Apache License 2.0; a copy is included
in [LICENSE](LICENSE).

Changed by Mutiro: rewritten for Mutiro's bound-book tool interface; separated
draft capture from permission-scoped transaction transitions; removed CLI setup,
account/group administration, app development, unsupported commands, and the
upstream blanket per-command approval process. Accounting concepts, lifecycle
semantics, query boundaries, reporting guidance, and review links were adapted.

`references/core-concepts.md` retains the upstream core model and examples,
with a Mutiro tool-scope notice and review wording adjusted to the owner's
configurable permissions. Each Bkper archive includes its own copy so it can
be installed independently.
