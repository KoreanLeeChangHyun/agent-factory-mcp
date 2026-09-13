# Agent execution policy

An Agent definition is mutable identity and presentation metadata. Every
executable configuration is an immutable Agent version. Runs always pin a
specific version, so later edits cannot change historical behavior.

Run creation is idempotent within a Workspace. The durable status machine is
`queued -> running -> succeeded|failed`, with immediate cancellation for queued
runs and cooperative `cancel_requested` handling for running jobs. Only failed
or cancelled runs may be retried, and retries preserve a link to the original.
HTTP and MCP submission use the same application service. It persists the Run
and its durable Job in one database transaction before broker publication;
retries create the linked Run and Job through that same boundary. A broker
publication failure leaves the committed Job eligible for outbox recovery.

Usage, estimated cost, tool calls, artifacts, linked input/output Documents,
and ordered run events are tenant-scoped records. The event table is the durable
replay boundary for polling or server-sent event delivery; Redis may accelerate
live delivery but never replaces this record. Execution workers are connected
in the scheduling and worker stage.
