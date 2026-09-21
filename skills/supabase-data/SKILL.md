---
name: supabase-data
description: Query, update, and export application records through Mutiro's Supabase data tool. Use for row operations and reports in existing tables; schema design and migrations belong to the schema skill.
---

# Supabase data

Use `supabase_sql` for reading and writing rows in the agent's connected
PostgreSQL database. Mutiro supplies the connection and credentials; no Supabase
CLI, project password, service key, or separate login is needed.

## Scope and isolation

Mutiro provisions one schema per agent, named `mutiro_<agent-derived hash>`.
It is shared by that agent's conversations, including owner and user
conversations. It is not a separate schema for each person or conversation.

`supabase_sql` connects as `<schema>_data`. This role has `SELECT`, `INSERT`,
`UPDATE`, and `DELETE` on the agent's tables, plus sequence usage for generated
IDs. It cannot create, alter, or drop the agent's tables. New tables created
through the schema connection automatically receive these data permissions.

**The data role has `BYPASSRLS`.** Queries are not filtered to the current Mutiro
sender. Row-level security policies do not isolate users of this tool. Follow
the owner's data-access rules, including any required user or tenant predicates;
never assume an unfiltered query is private to this conversation. SQL predicates
are application behavior, not a database-enforced per-user security boundary.
If the task requires a row boundary that the current setup cannot enforce,
explain that limitation rather than promising isolation.

The search path is the agent schema followed by `public`. Use unqualified names
for established agent tables; discover the actual schema instead of inventing
its hash. Search-path order is name resolution, not a permission boundary.
Objects granted through `public` may also resolve; do not use `public` as private
agent storage or try another agent's schema after a permission error.

## Discover, query, and change records

Inspect the existing schema before assuming table or column names:

```json
{"sql":"SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = current_schema() ORDER BY table_name, ordinal_position"}
```

Send one PostgreSQL statement per call. Bind values with `$1`, `$2`, etc. and
`params` in the same order. Objects and arrays in `params` are passed as JSON text;
cast placeholders where needed, for example `$1::jsonb`. Parameters cannot stand
for table names, column names, or SQL keywords; use inspected identifiers.

For example, after confirming an `invoices` table and its columns:

```json
{"sql":"SELECT id, amount, due_date FROM invoices WHERE customer_id = $1 AND status = $2 ORDER BY due_date, id LIMIT 100","params":["customer-123","open"]}
```

For a requested update or deletion, identify the affected records and use their
keys plus any required access predicates. `RETURNING` can show the actual changed
rows. Do not interpret a draft request, a report request, or the availability of
write access as authorization to change records.

Each call uses its own connection and transaction. Successful calls commit;
there is no shared transaction, temporary table, or session setting across
calls. Do not split `BEGIN`, a write, and `COMMIT` across tool calls.

## Results and exports

Results include `success`, `command`, `columns`, `rows`, `row_count`, and
`affected_rows`. For a statement with `RETURNING`, inspect the returned rows;
`affected_rows` is populated for statements without returned columns.

Inline rows and CSV exports are capped at **500 rows or 1 MiB**. A result with
`truncated: true` is incomplete. Use SQL aggregates for totals, and bounded
pages with a stable `ORDER BY` and `LIMIT`/`OFFSET` or a key-based cursor for
records. A limited page is not a total; even without `truncated`, further rows
may exist outside the query's limit. Give joined columns distinct aliases.

Set `export_csv: true` for a requested file. The tool saves the returned rows
under `Downloads/` in this conversation's workspace and returns `path` instead
of inline rows. Export does not remove the result caps or export the whole table
automatically. State the scope of a partial export.

## Failures and schema work

Read `error.code`, `message`, `detail`, `hint`, and `position` before correcting a
query. A missing table or column needs schema inspection and possibly an owner
schema change; it is not a reason to guess another schema or elevate privileges.
For uncertain write outcomes, check the target records before retrying; a lost
response does not prove the write failed. Use application uniqueness keys to
avoid duplicate inserts when the schema provides them.
