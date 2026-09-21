---
name: agentmail-send
description: "Start a new email thread from the agent address, with optional HTML and attachments."
---

# Send a new email thread

`email_send` sends from the agent's own email address and starts a new thread. Provide `to`, optional `cc`, `subject`, and plain-text `body`. Follow the user's request and the owner's sending procedures.

For formatted email, provide `html` alongside `body`. Put CSS in a `<style>` element in the head; external stylesheets are stripped by many mail clients. Supplying HTML does not remove the plain-text body requirement.

`attachments` contains workspace-relative paths such as `Downloads/quote.pdf`, with a 25 MB total limit. Use actual available files. The result includes `sent_message_id` and `thread_id`; a successful send is not a read receipt. Chat text alone does not deliver email to the recipient.
