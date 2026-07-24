# Project Supernatural Control Center

Staging-only management gateway and mobile owner console. It is deliberately separate from the public static site.

## Run locally

PowerShell:

```powershell
$env:CONTROL_CENTER_ENV='staging'
$env:CONTROL_CENTER_API_KEY='generate-a-random-value-at-least-24-characters'
$env:CONTROL_CENTER_OWNER_KEY='generate-a-different-random-value-at-least-24-characters'
node server.js
```

Open `http://127.0.0.1:8787`. Enter both keys only into the local dashboard. They are held in page memory and are not persisted.

## Test

```powershell
npm test
```

## Staging scope

The included store is seeded with synthetic records only. Runtime state and audit files are ignored by Git. No real accounts, user emails, databases, payments, production GitHub credentials or public publishing integrations are connected.

See [SECURITY.md](SECURITY.md), [APPROVAL_MATRIX.md](APPROVAL_MATRIX.md), [CHATGPT_SETUP.md](CHATGPT_SETUP.md), and [openapi.yaml](openapi.yaml).
