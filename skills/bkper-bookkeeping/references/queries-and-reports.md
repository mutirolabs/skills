# Bkper queries and reports

Use these patterns with `bkper_transactions` or `bkper_balances`, after selecting
a bound book and inspecting its existing accounts and groups.

| Need | Query pattern |
| --- | --- |
| Transactions for a month | `on:2026-09` |
| Transactions involving an account | `account:'Bank Account' on:2026-09` |
| Draft transactions | `is:draft` |
| Checked transactions in a period | `is:checked after:2026-01-01 before:2027-01-01` |
| Position at September 30 | `group:'<balance-sheet-root>' before:2026-10-01` |
| September income/expense activity | `group:'<profit-and-loss-root>' after:2026-09-01 before:2026-10-01` |

Replace placeholders with names returned from the selected book. Quote names
containing spaces inside the Bkper query. `on:` accepts a year, month, or day.
`after:` includes its date; `before:` excludes its date. Prefer explicit calendar
boundaries for reproducible answers and resolve ambiguous periods with the user.
Tool queries are strings, not shell commands; no shell escaping is needed.

## Balances and reports

Asset and Liability accounts carry balances forward. For an end-of-period
position, use an upper date boundary without discarding earlier activity.
Incoming and Outgoing accounts describe activity in a period; use both date
boundaries. Use the appropriate account or reporting group filter.

Groups can contain accounts and other groups; the same account can appear in
multiple reporting hierarchies. Do not add overlapping group totals together.
A group of Assets and Liabilities can represent net equity; a group of Incoming
and Outgoing accounts can represent net result. Preserve Bkper's returned sign
conventions and the owner's reporting hierarchy.

Use `bkper_balances` as the numerical source. A paginated transaction listing
cannot establish a ledger balance. Drafts do not affect balances, while posted
unchecked transactions do; checked-only reports are a different scope. A whole
book total is not revenue or profit because the complete ledger balances.

For a balance sheet or P&L, identify the existing root reporting group rather
than substituting a convenient subgroup. State the book, period/cutoff, group,
and any incompleteness alongside the returned values. If the necessary grouping
is missing or ambiguous, resolve it with the owner; these tools cannot create a
reporting structure. Do not invent totals or tax rules to fill the gap.

Separate interpretation from the values returned by Bkper. If a derived number
is needed, use an available deterministic calculation route and retain its inputs;
do not make language-model arithmetic the source of financial amounts.

For human review, build links only from observed book IDs and the actual query:
`https://bkper.app/books/{bookId}/transactions?query={encodedQuery}`.
URL-encode the query value.

Adapted and changed for Mutiro from Bkper's Apache-2.0 core concepts, CLI query
reference, and financial-statement guidance; see [../NOTICE.md](../NOTICE.md).
