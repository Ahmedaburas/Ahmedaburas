---
description: Use when the operator asks to clear, process, or empty the DARFIX dispatch queue.
---

# Clear the dispatch queue

1. Delegate to `dispatcher` (or call tools directly).
2. Confirm every `new_request`.
3. Assign technicians to unassigned jobs (auto-pick).
4. Return a table: booking → tech → status.
5. If anything failed, list it with the error and stop inventing ids.
