---
name: bkper-bookkeeping
description: Query Bkper books, accounts, transactions, and balances, and record draft transactions with receipts using Mutiro's Bkper tools. Use for ledger questions and transaction capture within existing account structures.
---

# Bkper bookkeeping

Work through Mutiro's connected Bkper tools. Authentication and allowed books
are supplied by the connection; no CLI installation or separate login is needed.

## Book and permission boundaries

Use `bkper_books` to discover the bound book IDs, names, Bkper roles, and default.
An omitted `book` uses that default. For multiple books, resolve the intended
ledger and pass its ID consistently. Accounts and transaction IDs are local to
a book; never transfer IDs from another book or invent them.

The connection only admits bound books, and Bkper enforces its permissions.
Tool availability does not guarantee that a book role permits a write.
Non-owner Mutiro conversations can query and record drafts when these tools are
available. These are the connected ledger's records, not a separate ledger for
each conversation; respect the owner's rules for shared financial data.

`bkper_accounts` lists existing accounts and groups. **No Mutiro Bkper tool
creates, renames, reorganizes, or deletes accounts or groups**, including in owner
conversations. Do not use a CLI or direct API as a workaround. Missing structure
must be addressed by the book owner through their Bkper management interface.
Posting, checking, and trashing are separate review actions, owner-only by
default; owners may open those tools to users. Recording a draft does not
automatically perform any of those transitions.

## Understand movements before choosing accounts

Bkper models an amount moving **from** one account **to** another. Every posted
movement has two sides, keeping the ledger balanced. `from_account` is the
credit/source account; `to_account` is the debit/destination account. The tool
requires existing IDs, not account names.

| Account type | Meaning and time basis |
| --- | --- |
| Asset | Resources held; cumulative position at a date. |
| Liability | Obligations; cumulative position at a date. |
| Incoming | Revenue sources; activity in a period. |
| Outgoing | Expenses and costs; activity in a period. |

Resolve names and IDs with `bkper_accounts` and preserve the book's own model.
For example, using accounts that actually exist in the book:

- Cash expense: Bank → Expense.
- Credit-card purchase: Credit Card → Expense; later payment: Bank → Credit Card.
- Sale on credit: Sales → Receivable; later collection: Receivable → Bank.

A settlement is not another expense or sale. Do not categorize from an account
name alone when its type or the owner's model differs.

## Query records and balances

Use `bkper_transactions` for matching records, draft review, receipt history, and
transaction details. Provide a Bkper `query`, an optional `limit` (1–100; default
50), and the returned `cursor` for another page of the same book and query.
The response is one page, capped at 64 KiB; reduce the page size or narrow the
query when necessary. Do not treat one page as the complete history.

Use `bkper_balances` for balances and report totals. Do not calculate an account
balance by summing a transaction page or reversing signs from generic accounting
intuition. For query syntax, date boundaries, and financial reports, read
[references/queries-and-reports.md](references/queries-and-reports.md).

## Capture a draft

Use `bkper_record` for a requested transaction capture. It **always creates a
draft**, including when every field is complete, and does not affect balances.
Only `description` is required; missing facts can remain absent in an incomplete
draft. Do not invent an amount, date, account, or receipt fact to make it complete.

Supply known fields:

- `date`: `YYYY-MM-DD`; `amount`: a decimal string such as `"25.50"`, with no
  currency symbol or grouping separators. Use the book's currency/resource.
- `from_account`, `to_account`: IDs from that book's existing accounts.
- `remote_id`: a stable external source-record identifier when one exists.
  Preserve it across retries for Bkper duplicate detection; do not generate a
  new identifier for the same source event.
- `attachments`: workspace-relative files such as `Downloads/receipt.pdf`, up
  to 10 files and 25 MiB total. Files are uploaded to Bkper before draft creation.
- `urls`: absolute HTTP(S) links attached as links, without uploading their content.

For example, substitute discovered IDs and facts from the receipt:

```json
{"book":"<bound-book-id>","description":"Printer paper, receipt R-104","date":"2026-09-20","amount":"25.50","from_account":"<bank-account-id>","to_account":"<supplies-account-id>","remote_id":"receipt:R-104","attachments":["Downloads/receipt.pdf"]}
```

Check the returned transaction and ID. Report it as recorded in draft, never as
posted or reconciled. A review link can use observed IDs:
`https://bkper.app/books/{bookId}/transactions/{transactionId}`.

## Recover without duplicates

After a timeout, oversized response, or unexpected posted result, query the book
before repeating a write. A response failure does not prove the draft was not
created. Attachment uploads can succeed before draft creation fails; preserve
that partial outcome rather than reporting that nothing changed or blindly
uploading again. For permission errors, surface the bound book and operation
that failed; do not try another book or credential to bypass the restriction.

Adapted and changed for Mutiro from Bkper's Apache-2.0 skill; see
[NOTICE.md](NOTICE.md) for source and scope of changes.
