// Scenario: replies must never carry a bearer token or a card number, no
// matter what a tool returned. Rewrite the text instead of trusting the
// instruction "never paste secrets".
export const beforeReply: BeforeReply = ({ reply }) => {
  const redacted = reply.text
    .replace(/\b(sk|mut_key|ghp)_[A-Za-z0-9_-]{12,}\b/g, "[redacted token]")
    .replace(/\b\d(?:[ -]?\d){12,18}\b/g, "[redacted number]");
  if (redacted === reply.text) return; // unchanged: send as is
  return { text: redacted };
};
