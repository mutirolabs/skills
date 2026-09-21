---
name: gmail-send
description: "Send a plain-text email through a connected Gmail account."
---

# Send through Gmail

`gmail_send` sends from the connected Gmail account. Supply recipient addresses in `to`, optional `cc`, and the requested `subject` and plain-text `body`.

Use the current request and owner's instructions to determine authorization and content. The tool sends immediately rather than saving a draft. Check the result for the returned `message_id` before reporting success. That identifier confirms the send operation, not that the recipient has read the email.
