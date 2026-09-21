---
name: gmail-draft
description: "Create a plain-text email draft in a connected Gmail account."
---

# Create a Gmail draft

`gmail_draft` saves a plain-text email without sending it. Provide recipient addresses in `to`, optional `cc`, plus `subject` and `body`.

Draft from the user's requested content and the owner's instructions. Preserve the intended recipients; names alone are not resolved email addresses. The result includes a `draft_id`. Report that a draft was saved, rather than that a message was delivered. The owner can review and send the draft from their mailbox.
