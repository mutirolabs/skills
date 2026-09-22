# Financial statements

Use for balance sheets, P&L/income statements, and other ledger-derived reports.
Adapted and changed for Mutiro from Bkper's Apache-2.0 financial-statement
reference; see [../../NOTICE.md](../../NOTICE.md).

## Numerical source and reporting model

A report must be reproducible from the same book data, date boundaries, reporting
groups, and assumptions. Use `bkper_balances` as the source of ledger values.
Keep commentary separate from returned numbers; do not use language-model
arithmetic or a sum of one transaction page as the final report calculation.

Reuse the owner's established report mappings, templates, and calculation
artifacts when supplied in the accessible context. Do not rebuild the reporting
hierarchy just because this is a new conversation. If no mapping exists, inspect
`bkper_accounts` for the book's groups and resolve the intended reporting root.
Use an available deterministic calculation route for derived values, preserving
its inputs and formulas. If such a route is unavailable, return the authoritative
balance data and explain which derived calculations remain unfinished.

## Choose the time basis

| Statement | Account types | Time basis | Balance query |
| --- | --- | --- | --- |
| Balance sheet | Asset and Liability | Cumulative position at cutoff | `group:'<root>' before:<end>` |
| P&L / income statement | Incoming and Outgoing | Activity in the period | `group:'<root>' after:<start> before:<end>` |

Use the book's relevant **root reporting group**. Do not silently replace a
balance-sheet root with only Assets, or a P&L root with only Revenue. Accounts
may appear in multiple group hierarchies; adding overlapping totals double
counts them. A whole-book zero balance is not profit, revenue, or net assets.
Preserve Bkper's returned signs and the established report's presentation rules.

`after:` includes its date and `before:` excludes its date. For a September 2026
balance sheet, use `before:2026-10-01`. For September P&L, use
`after:2026-09-01 before:2026-10-01`. Do not add a lower bound to a cumulative
position and thereby discard earlier balances. Resolve ambiguous relative
periods to explicit dates before producing a reproducible report.

For example, after discovering the actual P&L root name:

```json
{"book":"<bound-book-id>","query":"group:'<profit-and-loss-root>' after:2026-09-01 before:2026-10-01"}
```

Send this to `bkper_balances`. The root is a discovered book group, not a
literal placeholder or a reason to invent a group called "Profit and Loss".

## Produce and trace the result

Record the book ID, statement type, group IDs/names, date boundaries, query,
retrieval time, requested detail, output format, and reporting assumptions.
Returned balances reflect the ledger when queried; separate calls are not a
frozen book snapshot. Explain material incompleteness or changes during the run.
Drafts do not affect balances; posted unchecked transactions do. A checked-only
report has a narrower scope and must be identified as such.

Use `bkper_transactions` to investigate supporting movements or discrepancies,
following its returned cursor for the same query. Narrow queries if output
exceeds the 64 KiB cap. Do not replace missing balance data with a partial list
of transactions or invent unsupported expansion/output arguments.

If the reporting hierarchy is missing or unclear, describe the mapping needed
and resolve it with the owner. Mutiro cannot create or reorganize Bkper accounts
or groups. Producing a report does not authorize posting, checking, trashing, or
otherwise changing the underlying ledger to make it reconcile.

A quick exploratory answer may use live balance queries directly. State its
book, groups, dates, and provisional assumptions; do not turn a requested quick
answer into a requirement to build an app or CLI pipeline. Retain enough query
context for the owner to reproduce and review the result.
