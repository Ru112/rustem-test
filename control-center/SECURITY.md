# Security boundaries

- Staging is the only supported environment. `launchApproved` is hard-coded `false`.
- The public website is not imported, modified or controlled by this gateway.
- API and owner credentials must be different, random values of at least 24 characters.
- Credentials are environment variables, never committed or returned by an endpoint.
- The dashboard holds entered credentials only in memory for the current tab.
- All ChatGPT operations are enumerated in `openapi.yaml`; unknown routes and actions fail closed.
- JSON bodies are capped at 64 KB. Temporary restrictions are capped at 30 days.
- Per-address rate limiting, timing-safe credential comparison, restrictive browser headers and an append-only NDJSON audit trail are enabled.
- Owner approval uses a separate credential and endpoint that is omitted from the ChatGPT schema.
- GitHub access is request-only. No arbitrary repository path, command, token or merge operation is exposed.
- Backups in this prototype contain staging metadata only. Production database backups are intentionally not implemented.

Before production: replace the file store with an encrypted managed datastore, add identity-aware owner authentication with MFA, put the service behind a private access gateway, use a managed immutable audit sink, configure secret rotation, add signed deployment-provider webhooks, complete threat modeling and obtain owner approval.
