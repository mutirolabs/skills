---
name: note-card
description: Render one note as the team's HTML card. MUST be used for every card shown to a user, in chat or in a page. Never write card HTML from memory.
---

# Note card

Fill the template below and return it inside a ```html fence. Replace every
`{{...}}` placeholder; leave the `<style>` block byte for byte as it is.
Prose inside the card may be in the reader's language.

```html
<style>
  .note-card { font: 14px/1.4 system-ui, sans-serif; border: 1px solid #d0d7de; border-radius: 8px; padding: 12px 16px; max-width: 480px; }
  .note-card .subject { font-weight: 600; color: #1f2328; }
  .note-card .meta { color: #656d76; font-size: 12px; margin-top: 4px; }
  .note-card .text { margin-top: 8px; }
</style>
<div class="note-card">
  <div class="subject">{{subject}}</div>
  <div class="meta">{{author}} · {{date}}</div>
  <div class="text">{{text}}</div>
</div>
```
