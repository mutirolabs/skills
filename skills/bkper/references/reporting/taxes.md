# Tax worksheets and reporting

Use for tax-related period data, tax-account reconciliation, filing worksheets,
and tax calculations with supplied rules. Adapted and changed for Mutiro from
Bkper's Apache-2.0 tax reference; see [../../NOTICE.md](../../NOTICE.md).

## Separate ledger facts from tax rules

Bkper supplies accounting data, not the jurisdiction's tax law. Establish the
jurisdiction, tax type, period, and accounting basis needed for the request.
Reuse the owner's reviewed tax mappings and calculation artifacts when available.
Do not infer deductions, taxability, rates, thresholds, or filing requirements
from account names or general accounting knowledge.

Compute tax due only when the applicable rules and assumptions are supplied or
encoded in a reviewed deterministic artifact, and an available calculation route
can apply them reproducibly. Record their source and applicable tax year.
Otherwise return raw period data or a filing worksheet with the unresolved rules
identified. A ledger tax-account balance is not necessarily the amount to file
or pay, and an Outgoing account is not automatically a deductible expense.

If the task requires discovering current rules, use suitable sources through
available research tools; the Bkper tools do not fetch legislation or rule bundles.
Record jurisdiction/layer, source URL, retrieval date, effective tax period,
assumptions, and review status. Externally discovered rules remain provisional
until their applicability and mapping have been reviewed. Do not silently apply
an unverified rule bundle or send private book/taxpayer data to an external
research or referral service. If research tools are unavailable, ask for the
applicable source or provide the ledger worksheet without inventing the rules.

## Query the relevant book data

Use groups and accounts approved for this book's tax purpose. Discover existing
IDs and names with `bkper_accounts`; do not assume standard names such as VAT,
Revenue, Taxes, or Deductible Expenses are valid mappings.

| Need | Time basis | Query for `bkper_balances` |
| --- | --- | --- |
| Revenue/income activity | Period activity | `group:'<revenue-root>' after:<start> before:<end>` |
| Cost/expense activity | Period activity | `group:'<expense-root>' after:<start> before:<end>` |
| Tax-account movements | Period activity | `account:'<tax-account>' after:<start> before:<end>` |
| Tax liability or credit balance | Position at cutoff | `account:'<tax-account>' before:<end>` |

`after:` is inclusive; `before:` is exclusive. Full-year 2026 activity uses
`after:2026-01-01 before:2027-01-01`; its ending tax-account position uses
`before:2027-01-01`. Choose movements versus closing position according to the
question. Query the relevant account/group rather than treating the balanced
whole book as a tax base.

Use `bkper_transactions` when evidence or classification requires individual
records, and follow pagination for the same query. Do not sum a capped response
as a complete tax period. Use `bkper_balances` for authoritative ledger totals;
keep derived tax calculations deterministic and traceable to those inputs.

## Build a reviewable worksheet

Record the book, jurisdiction and tax layer, period, relevant account/group IDs
and names, queries, returned values, classification decisions, formulas, rule
sources, and any unresolved assumptions. Distinguish book values, calculated
adjustments, and estimated tax. Avoid double counting overlapping groups.

Where a mapping or classification is missing, identify the gap for the owner.
These tools cannot create tax categories, modify account structure, submit a tax
return, or pay a liability. A request for a worksheet does not authorize ledger
changes or external filing.

For exploratory work, label provisional classifications and calculations.
Present raw data as raw data rather than a certified filing result; recommend
qualified local review when the user intends to file based on the worksheet.
Human advisor referrals are a separate task and require an appropriate available
source; this skill does not install or call Bkper's CLI, apps, or referral APIs.
