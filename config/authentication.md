# Authentication policy

Browser authentication uses server-side opaque sessions. Only an HMAC-SHA-256
digest of each session, recovery token, verification token, or MCP API token is
stored. Session cookies are HTTP-only; state-changing browser requests also
require the matching CSRF cookie and header.

Local credentials use pwdlib's recommended Argon2 hasher. Repeated failures
lock the credential without changing the generic login error. A successful
password reset revokes every active session.

Google uses OpenID Connect. GitHub uses its OAuth web flow with PKCE and the
primary verified email endpoint. Provider access tokens are used to validate
identity for the current login and are not persisted as application sessions.
The Google OAuth client must be a Web application and its authorized redirect
URI must exactly match
`<AGENT_FACTORY_PUBLIC_BASE_URL>/api/auth/oauth/google/callback`. Both
`AGENT_FACTORY_GOOGLE_CLIENT_ID` and `AGENT_FACTORY_GOOGLE_CLIENT_SECRET` are
required; a partially configured provider fails settings validation and an
unconfigured provider is not advertised to the browser.

Staging and production reject the known development secret, insecure cookies,
and non-HTTPS public URLs at settings validation time. MFA enrollment has an
encrypted provider-neutral persistence boundary; factor implementation and key
management are completed with the security milestone.
