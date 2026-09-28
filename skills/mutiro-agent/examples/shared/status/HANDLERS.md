# Handlers contract for Notes status

## loadStatus

Notes grouped by subject, newest subject first.

### Request payload
`{ "limit": 50 }` — at most this many notes are considered (1–200, default 50).

### Result
```json
{ "subjects": [{ "subject": "acme", "count": 3, "last": "2026-09-28" }], "updated_at": "ISO timestamp" }
```

### Procedure
1. Call `notes_list` with `limit`.
2. Group the notes by `subject`; `count` is the number of notes, `last` the
   day of the newest one.
3. Sort by `last`, newest first. Answer with `respond_to_action`.

### Errors
If `notes_list` fails, answer with the error text; never invent rows.
