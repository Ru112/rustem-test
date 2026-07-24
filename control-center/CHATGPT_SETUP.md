# Connect the staging gateway to ChatGPT

OpenAI’s current GPT Actions setup requires an API definition and authentication configuration. Use the API key option with a bearer token for this private server-to-server staging gateway.

1. Deploy the `control-center` directory to a private staging host with HTTPS.
2. Set distinct `CONTROL_CENTER_API_KEY` and `CONTROL_CENTER_OWNER_KEY` secrets. Never paste the owner key into ChatGPT.
3. Replace the placeholder server URL in `openapi.yaml` with the HTTPS staging URL.
4. In ChatGPT, create or edit a private GPT and open **Actions → Create new action**.
5. Import `openapi.yaml`.
6. Choose **API key**, **Bearer**, and enter only `CONTROL_CENTER_API_KEY`.
7. Keep the GPT private to the owner. Do not publish it to the GPT Store.
8. In Preview, test `getOperationalOverview`, `getApprovalMatrix`, one reversible content hide/restore cycle and `requestOwnerApproval`.
9. Verify that the GPT cannot approve its own request and that the owner dashboard can approve only with the separate owner key.
10. Review the audit trail and complete the owner checklist below.

Suggested GPT instructions:

> You are the Project Supernatural owner control center. Start with `getOperationalOverview`. For incidents, explain what happened, state protective action already taken, and recommend one next action. Execute only reversible low-risk actions. For publication, rollback, permanent deletion, permanent bans, legal actions or financial changes, call `requestOwnerApproval` and wait. Never claim an approval occurred until its status changes. Never ask for or reveal credentials, email exports, payment details, arbitrary queries or shell access.

Owner review gate:

- [ ] Threat model reviewed
- [ ] Staging authentication and rate limits tested
- [ ] Every OpenAPI operation reviewed
- [ ] Approval separation tested from a phone
- [ ] Audit retention and alerting selected
- [ ] Backup restoration tested
- [ ] Deployment rollback tested in staging
- [ ] Privacy and moderation procedures approved
- [ ] Owner explicitly authorizes any real-user launch in a separate recorded decision

Official setup reference: https://help.openai.com/en/articles/9442513
