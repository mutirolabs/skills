---
name: supabase-schema
description: Create and migrate tables, indexes, views, and functions in Mutiro's isolated Supabase agent schema. Use for structural database changes and migration backfills; routine record queries and exports belong to the data skill.
---

# Supabase schema

Use `supabase_admin_sql` when the task changes database structure: creating or
altering tables, constraints, indexes, views, or functions, and dropping objects
in the agent schema. It also executes data statements needed for a migration.
For ordinary record work, use the data tool when available; CSV export is a data
tool feature. This schema tool is owner-only by default in Mutiro; the effective
tool inventory determines access.

Mutiro supplies credentials. This is the agent's schema connection, not a
Supabase project administrator, dashboard API, or service-role key. It does not
manage Supabase Auth, Storage, project settings, or other agents' schemas.

## Two roles, one shared agent schema

Mutiro provisions `mutiro_<agent-derived hash>` and two PostgreSQL roles:

| Role | Purpose |
| --- | --- |
| `<schema>_schema` | Owns the agent's database objects and can create, alter, and drop them; also reads and writes data. Used by this tool. |
| `<schema>_data` | Reads and writes rows in existing tables and uses their sequences. Cannot create, alter, or drop those tables. Used by the data connection. |

Tables created by the schema role automatically grant `SELECT`, `INSERT`,
`UPDATE`, and `DELETE` to `_data`; sequence defaults grant `USAGE` and `SELECT`.
Design new tables for that access model. Adding a table is not creating an
owner-private storage area. Do not revoke these grants or change roles merely
to work around a query error.

**Both roles have `BYPASSRLS`.** The schema and reachable table rows are shared
across this agent's conversations. Mutiro does not provide a PostgreSQL role or
session identity per sender. Enabling RLS or adding a `user_id` column does not
by itself isolate Mutiro users. An application can use owner-defined tenant
predicates, but these tools do not enforce that boundary. If hard per-user
isolation is required, identify the missing enforcement rather than presenting
RLS policies as a solution for these connections.

Unqualified names resolve in the agent schema first, then `public`. PostgreSQL
privileges enforce access; the search path is not a sandbox. Keep agent objects
in the agent schema, and do not create them in `public`. The schema role has no
project administration or cross-agent schema authority.

## Inspect before changing structure

Discover the actual schema and current role rather than computing their names:

```json
{"sql":"SELECT current_schema() AS schema_name, current_user AS role_name"}
```

Inspect `information_schema.columns`, `table_constraints`, and
`key_column_usage`, filtered to `table_schema = current_schema()`. Inspect
`pg_indexes` for existing indexes and dependencies where relevant. Check the
actual rows before changing types, adding uniqueness or `NOT NULL`, or removing
columns. Follow the owner's existing naming and domain model.

For a new application table, choose keys, relationships, constraints, and useful
indexes deliberately. For example, after agreeing on a simple task model:

```json
{"sql":"CREATE TABLE tasks (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text NOT NULL, completed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())"}
```

This table is immediately available to the data role. Use a unique source or
business key when records need duplicate protection. Avoid `SECURITY DEFINER`
routines as a permission workaround; they execute with their owner's privileges.

## Execute and verify a migration

Send one PostgreSQL statement per call with `sql` and optional `params`. Bind
values using `$1`, `$2`, etc.; identifiers must be inspected SQL identifiers,
not value parameters. Each call has its own transaction and commits separately.
A sequence of calls is not an atomic migration, and failure of a later call does
not roll back earlier changes. Do not split transaction-control statements
across calls or depend on temporary tables surviving another call.

For a change that needs backfilling, use an order that keeps intermediate states
usable: add the column, backfill under the intended predicate, verify values,
then apply constraints. A rename, type conversion, or drop can break existing
queries; include that effect in the requested change. Do not drop and recreate
a populated table to solve a migration error. Preserve the user's authorized
scope and clarify destructive choices only when the request leaves them open.

Calls have a 20-second statement timeout and 3-second lock timeout. All SQL runs
inside a transaction, so operations such as `CREATE INDEX CONCURRENTLY` cannot
run through this tool. Large migrations or operations requiring project
administration need a suitable owner-managed route.

Inspect `success` and the database diagnostics (`code`, `message`, `detail`,
`hint`, `position`). Reinspect objects and affected rows after the change.
Schema queries have the same 500-row/1-MiB cap as data queries; a truncated
inspection is incomplete. After a lost response, inspect before retrying DDL.
