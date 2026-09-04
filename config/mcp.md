# MCP interface policy

The MCP endpoint is an authenticated resource server at `/mcp` internally and
at `/factory/mcp` through the production proxy. It accepts only
revocable `afm_` API bearer tokens and maps each tool to an explicit token scope.
Token scope never replaces RBAC: every call also verifies organization and
Workspace membership before applying transaction-local RLS context.

Six fixed resources describe the Workspace Activities. Read tools expose
Workspace, Document, Agent, schedule, integration, log, and test status data
without credentials or internal storage keys. Mutation tools return durable Job
identities when introduced; long-running work is never held inside one MCP
request. Tool names and schemas are versioned API surface and breaking changes
require a new tool name or server major version.
