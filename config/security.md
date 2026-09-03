# Security baseline

Production and staging reject wildcard hosts/origins, weak auth and integration
keys, insecure cookies, and non-HTTPS public URLs at startup. HTTP responses use
a same-origin CSP, clickjacking, MIME-sniffing, referrer, permissions, opener,
and HTTPS transport protections. CORS is disabled unless exact origins are set.

Login, webhook, and MCP requests use Redis-backed distributed rate limiting.
Sensitive production endpoints fail closed when Redis is unavailable. Webhook
signatures, event IDs, payload size, CSRF, upload media/size rules, and safe path
resolution provide additional boundary-specific protection. Outbound connector
adapters must validate HTTPS URLs and re-check resolved addresses to prevent DNS
rebinding before making requests.

API, worker, and migration database identities are separate. Only the worker
role has BYPASSRLS for explicit cross-tenant schedulers; every job reapplies its
stored tenant context before domain work. Containers run as UID 10001. Secrets
come from deployment secret stores and never from images or source control.

Backups contain PostgreSQL plus object storage and are valid only after restore
tests. Tenant deletion is a staged workflow: suspend access, export on request,
soft-delete authoritative rows, expire object versions and derived indexes after
retention, then record completion in the immutable audit system.
