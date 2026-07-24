# Approval matrix

The gateway denies every operation that is not explicitly listed here.

| Action class | Examples | Reversible | ChatGPT may execute | Owner approval |
|---|---|---:|---:|---:|
| Read-only | Overview, health, incidents, audit | Yes | Yes | No |
| Low-risk protection | Hide/restore content, hide comment | Yes | Yes | No |
| Low-risk moderation | Warn user, restore temporary access | Yes | Yes | No |
| Time-bounded restriction | Restrict user for 1–30 days | Yes | Yes | No |
| Incident operations | Report and group incidents | Yes | Yes | No |
| Emergency protection | Hide pending-review stories | Yes | Yes | No |
| Operational staging | Backup metadata, stage named revision | Yes | Yes | No |
| Constrained code work | Draft a GitHub change request | Yes | Draft only | No |
| Publication | Publish a reviewed story | Yes | Request only | Required |
| Rollback | Roll back a deployment | Usually | Request only | Required |
| Permanent enforcement | Permanent ban or deletion | No | Request only | Required |
| Legal or financial | Legal response, payment change | No | Request only | Required |

Approval is intentionally two-channel:

1. ChatGPT creates an approval request through `requestOwnerApproval`.
2. The owner reviews the exact action, target, reason and payload in the dashboard.
3. The dashboard sends the approval ID in both the URL and `X-Owner-Confirmation`.
4. The decision is appended to the audit log.

The owner approval endpoints are not included in `openapi.yaml`, so they are unavailable to ChatGPT Actions.
