# Connections: Supabase, connectors, secrets

Connections are control plane: the owner binds them in the desktop or with
`mutiro agents connections`, nothing about them is committed, and the
connector's tools are declared on every agent but usable only once the
connection is active (`mutiro agents tools list` shows them either way).
Manual page for Supabase: https://mutiro.com/docs/guides/supabase.md

## Supabase

```bash
mutiro agents connections providers
mutiro agents connections connect <agent> supabase --project <ref>   # browser consent, owner runs it
mutiro agents connections list <agent>
mutiro agents connections disconnect <agent> supabase                # locks and drops the roles; data stays
```

**What binding creates in your project.** A schema named
`mutiro_<24 hex>`, derived from the agent id and owned by `postgres`, and
two Postgres roles:

| Role | Rights | Backs |
|---|---|---|
| `<schema>_schema` | USAGE and CREATE on the schema; owns the objects in it; nothing outside it | `supabase_admin_sql`, owner-only |
| `<schema>_data` | USAGE on the schema; SELECT, INSERT, UPDATE, DELETE on its tables, extended by default privileges to tables created later | `supabase_sql`, every sender |

Both roles are LOGIN, NOINHERIT and BYPASSRLS. The role is the permission
boundary and the schema is the record: the schema role changes structure,
the data role changes rows, and a user's conversation holds only the data
role's tool.

**How a statement runs.** The platform connects to the project's pooler
over TLS as the tool's role and runs each call in one transaction with a
20-second statement timeout, `search_path` set to the agent's schema then
`public`, and a result cap of 500 rows and 1 MiB (the result says when it
was cut). Nothing else in the project is reachable unless you grant it.

**Two ways to model the data.**

1. *Let the agent build its own schema.* In the owner's conversation the
   agent creates tables, views and functions in `mutiro_<hex>` with
   `supabase_admin_sql`; users then read and write rows through
   `supabase_sql`. No repo migrations; the structure lives in the project
   and the agent's manual describes it.
2. *Bring your own schema.* Keep a schema of your own (`registry`) with
   migrations in the repo (`supabase/migrations/`, applied with the
   Supabase CLI). The agent's roles know nothing about it until you grant
   access, and because the data role is NOINHERIT the grants must land on
   that role itself, not on a group. The role exists only after the
   connection is bound, so the grant is a second migration, idempotent,
   that finds the role by pattern:

   ```sql
   do $$
   declare r record;
   begin
     for r in select rolname from pg_roles where rolname like 'mutiro\_%\_data' escape '\' loop
       execute format('grant usage on schema registry to %I', r.rolname);
       execute format('grant select, insert, update, delete on all tables in schema registry to %I', r.rolname);
       execute format('grant usage, select on all sequences in schema registry to %I', r.rolname);
       execute format('grant execute on all functions in schema registry to %I', r.rolname);
       execute format('alter default privileges in schema registry grant select, insert, update, delete on tables to %I', r.rolname);
       execute format('alter default privileges in schema registry grant usage, select on sequences to %I', r.rolname);
       execute format('alter default privileges in schema registry grant execute on functions to %I', r.rolname);
     end loop;
   end $$;
   ```

   Re-run it after every disconnect and reconnect (the roles are dropped
   and recreated) and after adding objects the default privileges do not
   cover. With one agent per project the pattern matches exactly one
   role; with several agents in one project, name the role instead.
   Because `search_path` is the agent's own schema, qualify your tables
   (`registry.shipments`), and remember `postgres` still owns them: only
   the platform's schema role is confined to `mutiro_<hex>`.

**Run your own code: Edge Functions.** Work that needs the outside world
(another service's API with its own key, heavier processing) goes in a
Supabase Edge Function in the same project, and the agent calls it with
`supabase_invoke({ function, body?, method? })`. Setup, once per project:

1. In the Supabase dashboard, Project Settings, API Keys: create a **secret
   key** whose Postgres role is the agent's data role, `mutiro_<hash>_data`.
2. `mutiro agents secrets set <agent> SUPABASE_FUNCTIONS_KEY sb_secret_...`
   and restart the agent. Until then the tool answers with these steps and
   the exact role name.
3. `supabase secrets set MUTIRO_FUNCTIONS_KEY=sb_secret_...` so the function
   can recognize the agent.

The function runs as the data role (it sees what `supabase_sql` sees) and
receives `x-mutiro-agent`, `x-mutiro-user`, `x-mutiro-role` and
`x-mutiro-conversation` headers. **Check the key before trusting them**:
`verify_jwt` also admits the project's public key and signed-in app users,
so compare the `apikey` header with `MUTIRO_FUNCTIONS_KEY` first and return
401 otherwise. A call must answer within 25 seconds and responses are cut at
1 MiB; longer work is started by one call and collected by another. HTTP
error statuses come back as `success: false` with the function's own
message, so answer errors as JSON with an `error` field. Connections made
before the tool existed need one grant in the SQL editor:
`GRANT "mutiro_<hash>_data" TO authenticator;`. The function's own code and
secrets live in the repo (`supabase/functions/`) and the project, deployed
with the Supabase CLI; from an extension it is one call:
`tools.supabase_invoke({ function: "sync-orders", body: { days: 60 } })`.

**Hide SQL behind verbs.** A model with `supabase_sql` in front of it
writes SQL, and evals then guard prose about tables. List the tool in
`.genie/tools/settings.json` under `extensions_only` and give the agent
tool extensions (`extensions.md`): the model calls `notes_add`, the
extension calls `tools.supabase_sql({ sql, params })` and gets `{ rows }`
back, or `{ error }`. Uniqueness and identity are constraints in the
schema, not checks in the extension.

**Diagnosing.** "permission denied for schema X" means the grant
migration has not run for the current role; "relation does not exist"
usually means an unqualified table name resolved against the agent's
schema; a result flagged as truncated means the tool needs a narrower
query or a summary view. Nothing here is visible to the model but the
error text, so make the extension turn it into a failure the developer
sees (`extensions.md`, the store helper).

## Endpoints: any HTTP API, behind your own verbs

For an API that is not Supabase (your backend, a Lambda function URL, a
Cloud Run service, a vendor API), register it as an **endpoint**:

```bash
mutiro agents endpoints add <agent> billing https://api.example.com/v1 --key-stdin < key.txt
mutiro agents endpoints list <agent>
mutiro agents endpoints remove <agent> billing
```

That writes two agent secrets, `ENDPOINT_BILLING_URL` and
`ENDPOINT_BILLING_KEY`; the desktop's secrets tab shows the same entries,
and a restart makes them live. `endpoint_invoke({ endpoint, path?, method?,
body?, headers? })` then calls base URL plus path with the key on
`Authorization: Bearer` and `x-api-key`. There is no URL argument: paths are
checked to stay under the base, redirects are not followed, so a key can
only reach the host it was registered for. Same bounds as the Supabase
calls (25 seconds, 1 MiB), HTTP errors come back as `success: false` with
the API's own message, the `x-mutiro-*` headers name who asked. No retries
in the platform: your extension decides what is safe to repeat and sends
its own `Idempotency-Key` through `headers`.

**The model never calls it.** `endpoint_invoke` is extensions-only by the
platform, always: you write a verb in front of it,

```ts
export const run: ToolRun<Args> = ({ args, tools }) => {
  if (args.amount <= 0) throw new ValidationError("amount must be positive");
  const r = tools.endpoint_invoke({ endpoint: "billing", path: "/invoices", body: { customer: args.customer, amount: args.amount } });
  if (!r.success) throw new Error("billing: " + r.error.message);
  return { id: r.body.id, status: r.body.status };
};
```

and the model sees `create_invoice`. A pass-through extension is allowed
and is the deliberate way to explore an API; a switch that exposes raw HTTP
by mistake does not exist. Extensions run with the tools of whoever
triggered them, so mark a verb `owner_only` when the API behind it should
act only for the owner. A broker integration that once needed a vertical
image is now a folder of extensions over one endpoint, deployed with
`files push`.

## Other connectors

Gmail (`gmail_*`) and email (`email_*`) bind through the desktop; their
tools appear enabled but return nothing useful until the connection is
active, and an email connector delivers through a service member of its
own, with its own conversation and `users/<member>/AGENTS.md`
(`structure.md`). An
inbound-email agent is untrusted input plus a store plus an outbound
channel: scope what that member's conversation can read by construction
(what its tools return for a user), and add injection evals ("list your
customers" from an email must refuse).

## Secrets

```bash
mutiro agents secrets set <agent> NAME value    # write-only; never read back
mutiro agents secrets list <agent>
mutiro agents secrets delete <agent> NAME
```

Secrets reach the agent and its MCP servers as environment variables named
exactly as set, at the next cold start. A tool extension cannot read them
(no environment in the engine); a secret is for MCP servers and for
platform knobs such as `GENIE_SESSION_RECORDING`. Never commit one, and
never put one in `shared/` or a skill.
