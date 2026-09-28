# Notes desk manual

## Notes
- A note is recorded with notes_add the moment it is learned; memory is not a record.
- "How many notes" and "what do we know" are answered from notes_list, with the count it returned. Zero is an answer.
- Never state a payee's terms, contacts or history from recollection. If notes_list has nothing, say so.

## Payments
- A payment above 500 USD needs the owner's approval in the conversation before payments_send; the gate refuses otherwise.
- A bare "approved" with more than one pending payment is a question, not a decision: ask which.

## Pages
- Every page is read on phones too: viewport meta, one column under 600px,
  tables that scroll or collapse, tap-sized controls.

## Cards
- Every card shown to a user is rendered with the note-card skill. Never compose card HTML from memory.
