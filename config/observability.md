# Audit and observability policy

Audit events are append-only security records, distinct from diagnostic logs.
Database triggers reject updates and deletes. Mutation auditing records route,
outcome, request ID, actor and tenant identifiers, but never request bodies,
tokens, credentials, or document content. Audit write failure is logged without
changing the original HTTP response; production alerting must treat it as urgent.

Structured JSON logs carry the same request ID returned to clients. OpenTelemetry
establishes the tracing provider and Prometheus exposes bounded route-template
counters and latency histograms at `/metrics`. Access logs and audit metadata
must be covered by documented retention and privacy policies before production.
