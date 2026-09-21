---
name: agentmail-attachments
description: "Download an incoming email attachment into the workspace."
---

# Download an email attachment

`email_get_attachment` takes the email `message_id` and its `attachment_id`, as supplied in the incoming email event or existing attachment metadata. Use both IDs from the same message.

The tool saves the file under the conversation workspace's `Downloads/` directory and returns a workspace-relative `path`. Images and PDFs may also be returned directly for inspection. Use the returned path rather than assuming a filename or location. Downloading a file does not send or share it.
