# CAN-SPAM Compliance Checklist for Am Outbound Email

**Reference:** FTC CAN-SPAM Act — https://www.ftc.gov/tips-advice/business-center/guidance/can-spam-act-compliance-guide-business
**Penalty:** Up to $51,744 per violating email

---

## Pre-Send Checklist (every campaign)

### Sender Identity
- [ ] "From" name clearly identifies Am or helloam.bot — not misleading
- [ ] "From" email address is a real, monitored inbox (e.g. hello@helloam.bot)
- [ ] Reply-To address is valid and monitored
- [ ] Sending domain matches From domain (no spoofing)

### Technical Requirements (Google/Yahoo 2024 — required for 5,000+/day)
- [ ] SPF record published for sending domain
- [ ] DKIM signature enabled on sending domain
- [ ] DMARC policy published (p=none minimum, p=quarantine recommended)
- [ ] One-click unsubscribe header in email (List-Unsubscribe: <mailto:...>, <https://...>)
- [ ] Spam rate below 0.1% (hard limit 0.3%) — check Google Postmaster Tools

### Subject Line
- [ ] Subject line accurately reflects the email content
- [ ] No deceptive or misleading subject lines
- [ ] No "RE:" or "FW:" prefix unless it's actually a reply/forward

### Email Body
- [ ] Physical mailing address in every email (US address of Am/helloam.bot)
- [ ] Clear and conspicuous unsubscribe link
- [ ] Unsubscribe link works (test before sending)
- [ ] No deceptive routing information in headers

### Unsubscribe Mechanism
- [ ] One-click unsubscribe link in every email
- [ ] Opt-outs honored within 10 business days (CAN-SPAM requirement)
- [ ] Unsubscribed email added to `leads/suppression.csv` immediately
- [ ] Suppression list checked before every send batch

### Targeting
- [ ] All recipients are US-based businesses (CAN-SPAM scope)
- [ ] Emails collected from public sources only (company websites, directories)
- [ ] No purchased lists with consent flags misrepresenting B2C as B2B

---

## Sender Domain Setup (one-time)

### SPF
Add TXT record to DNS:
```
v=spf1 include:sendgrid.net include:mailgun.org ~all
```
(replace with your actual ESP)

### DKIM
Enable DKIM in your ESP (SendGrid, Mailgun, Postmark, etc.) and add the CNAME records they provide.

### DMARC
Add TXT record `_dmarc.yourdomain.com`:
```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@helloam.bot; pct=100
```

### List-Unsubscribe Header
Your ESP should add this automatically. Confirm it's enabled in campaign settings.

---

## Physical Address Requirement

Every email must include Am's physical mailing address in the footer. Example:

```
Am (helloam.bot) | [Street Address] | [City, State ZIP] | United States
To unsubscribe, click here: [unsubscribe link]
```

Update this with the actual mailing address before first send.

---

## GDPR Note

CAN-SPAM does not require prior consent for B2B commercial email. However:
- Scope outreach to **US-only** targets to stay under CAN-SPAM only
- If targeting EU businesses: GDPR requires explicit prior consent — do not use this database for EU outreach without a consent mechanism
- If targeting California: CCPA applies to personal data; B2B contact emails at company domains are generally exempt

---

## Template Footer (Required)

Include this in every outbound email template:

```
---
You're receiving this because your business email is publicly listed.
To unsubscribe: [one-click unsubscribe link]

Am · helloam.bot · [Physical Address] · United States
```
