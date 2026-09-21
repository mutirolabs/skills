---
name: agentmail-reply
description: "Reply within an existing email thread from the agent address."
---

# Reply within an email thread

`email_reply` takes the existing email `message_id` and a plain-text `body`. A reply remains in the original thread. Replies to received messages go to their sender; replies to the agent's own sent messages go to their recipients, rather than back to the agent. `reply_all` includes the original recipients.

Use the message identifier from the incoming event or task context, not the Mutiro chat message ID or the email thread ID. Chat responses are separate from email delivery. Follow the current request and the owner's reply procedures.

For formatting, pass `html` alongside `body`, with any CSS in a `<style>` element. `attachments` accepts workspace-relative paths with a 25 MB total limit. The result includes the new `sent_message_id` and `thread_id`; check it before reporting a successful reply.
