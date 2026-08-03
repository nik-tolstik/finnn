# Reusable Solutions

`docs/solutions` is the compound step of Finnn's planning workflow. It stores concise, searchable lessons from completed work so a future agent can avoid a known failure mode or reuse a proven approach.

Create a solution record only when the lesson will plausibly help another task. Do not duplicate the work log, write a release summary, or create a record just because a task was completed.

## Format

Use one kebab-case Markdown file per reusable lesson:

```text
docs/solutions/<topic>.md
```

Start with searchable metadata:

```yaml
---
title: Short, concrete lesson title
area: api | web | database | operations | workflow
tags: [relevant, searchable, terms]
created: YYYY-MM-DD
related_evidence:
  - Pull request, code, test, or operational record
---
```

Then describe:

1. The recurring problem or risk.
2. The proven solution and why it works.
3. How to prevent the problem or detect it automatically next time.
4. Links to the relevant pull request, code, test, or operational evidence.

Keep the record brief and evidence-based. Update `AGENTS.md` only when the lesson becomes a general project rule that is clear, durable, and enforceable.
