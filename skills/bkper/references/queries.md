# Bkper queries

Use with `bkper_transactions` or `bkper_balances` after selecting a bound book
and inspecting its existing accounts/groups. Adapted and changed from Bkper's
Apache-2.0 CLI query reference; see [../NOTICE.md](../NOTICE.md).

| Need | Query pattern |
| --- | --- |
| Transactions for a month | `on:2026-09` |
| Transactions involving an account | `account:'Bank Account' on:2026-09` |
| Draft transactions | `is:draft` |
| Checked transactions in a period | `is:checked after:2026-01-01 before:2027-01-01` |
| Account position at September 30 | `account:'Bank Account' before:2026-10-01` |
| Group activity for September | `group:'<group-name>' after:2026-09-01 before:2026-10-01` |

Replace placeholders with names from the selected book and quote names containing
spaces within the query. `on:` accepts a year, month, or day. `after:` includes
its date; `before:` excludes its date. Resolve ambiguous periods and prefer
explicit dates for reproducible reports. Queries are tool argument strings,
not shell commands; no shell escaping is needed.

Transaction results contain one page (default 50, maximum 100), with a cursor
for the next page of the same book/query. Results are capped at 64 KiB. Narrow
the query or page size when needed, and do not treat a page as the whole ledger.

Use `bkper_balances` for numerical balances. For financial statements or tax
worksheets, follow the specific reporting reference linked from `SKILL.md`.

For human review, use observed book IDs and the actual query:
`https://bkper.app/books/{bookId}/transactions?query={encodedQuery}`.
URL-encode the query value.
