# LoveCoin — Supabase Auth Security Settings

This document covers the authentication security configuration that a developer must apply
in the **Supabase dashboard** and **Bachs dashboard** before the app goes to production.
It also documents the MFA threat model decision for the MVP.

> **Related spec requirements:** 21.14, 21.15, 21.16, 21.19  
> **Local config:** `supabase/config.toml` mirrors these settings for local development via the Supabase CLI.

---

## 1. Email Confirmation (Requirement 21.15)

### What to configure

Email confirmation must be enabled so that an unverified email address cannot create purchase
orders or claim coins. A user who has not confirmed their email is effectively untrusted — their
email could be a typo, belong to someone else, or have been registered by a bot.

### Steps (Supabase Dashboard)

1. Open your project in the [Supabase dashboard](https://app.supabase.com).
2. Go to **Authentication → Providers → Email**.
3. Enable **"Confirm email"** (toggle on).
4. Save changes.

### Local development (config.toml)

`supabase/config.toml` already sets `enable_confirmations = true` under `[auth]`.  
When running `supabase start` locally, the Supabase local stack will require email
confirmation for new signups. Inbucket (the local email catcher at `http://localhost:54324`)
will capture the confirmation emails so you can confirm accounts during development.

### Why this matters

Without email confirmation, anyone can sign up with `victim@example.com` and immediately
start making purchases under that address. Email confirmation is a low-friction gate that
prevents this class of abuse.

---

## 2. OAuth Redirect URL Restrictions (Requirement 21.16)

### What to configure

Only trusted origins must be added to the **Allowed Redirect URLs** list. If an attacker
can register a URL like `https://evil.example.com/auth/callback`, they can craft a link that
redirects the OAuth authorization code to their server and exchange it for the user's
session token.

### Allowed URLs

| URL | Purpose |
|-----|---------|
| `https://your-production-domain.com` | Production app (also covered by `site_url`) |
| `http://localhost:5173` | Vite dev server |
| `http://localhost:3000` | Alternative local dev port |
| `https://<explicit-preview-url>.vercel.app` | Named preview deployments (add individually) |

**Do not** use wildcard patterns like `https://*.vercel.app`. Supabase supports wildcards in
some contexts but allowing `*.vercel.app` would permit any Vercel deployment — including
those owned by other users — to receive OAuth redirects.

### Steps (Supabase Dashboard)

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to your production domain, e.g. `https://lovecoin.app`.
3. Under **Redirect URLs**, add each URL from the table above individually.
4. Remove any wildcard or catch-all patterns.
5. Save changes.

### Keeping the list up to date

Each time a new permanent preview or staging environment is created, add its URL here and in
`supabase/config.toml` → `additional_redirect_urls`. Remove URLs for decommissioned
environments promptly.

---

## 3. MFA Threat Model — MVP Risk Acceptance (Requirement 21.14)

### Background

Supabase Auth supports TOTP-based multi-factor authentication (MFA). Requiring MFA for
accounts that make purchases would raise the bar for account takeover: even if an attacker
steals a user's password, they cannot complete a purchase without the second factor.

### MVP decision: MFA is **not required** for the initial release

For the MVP we explicitly **accept the risk** of not mandating MFA. The rationale:

| Factor | Assessment |
|--------|-----------|
| User friction | Adding mandatory MFA on first purchase introduces significant drop-off, particularly for the target Nigerian mobile audience where TOTP app adoption is lower. |
| Payment window | Bachs Hosted Checkout requires the user to be present and to enter payment credentials. An attacker who takes over an account cannot silently drain funds — they would need to complete a Bachs payment flow themselves. |
| Coin value | LoveCoin purchases are sentimental keepsakes, not high-liquidity assets. There is no secondary market where stolen coins can be resold. |
| Existing controls | Email confirmation (§1 above), Bachs payment verification, and webhook-based coin granting already form a multi-layer defence. |
| MVP timeline | Mandatory MFA requires additional UI work (enrolment flow, recovery codes, enforcement bypass for support staff). |

### Residual risk

An attacker who compromises a user's email account and Supabase password can initiate
purchases on that user's behalf. They would also need to complete the Bachs checkout (which
requires card details or bank login), so the realistic attack surface is limited to accounts
whose payment methods are pre-saved in a browser that has been compromised.

### Post-MVP path to enabling MFA

When the user base grows beyond the MVP and the engineering capacity exists:

1. **Enrolment UI** — Add a TOTP enrolment screen in the profile settings page.
2. **Enforcement gate** — Before the `createPurchaseOrder` mutation is dispatched,
   check `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. If the AAL is `aal1`
   (password only) and the user has a TOTP factor enrolled, prompt for a second factor.
3. **Supabase policy** — Create an RLS policy on `purchase_orders` that checks
   `auth.jwt() ->> 'aal' = 'aal2'` to block inserts from sessions that have not
   completed MFA, as a server-side enforcement layer independent of client checks.
4. **Supabase dashboard** — In **Authentication → MFA**, consider enabling
   "Enforce MFA for all users" once the enrolment flow is live and the user base
   has had time to opt in.

### Reference

- [Supabase MFA docs](https://supabase.com/docs/guides/auth/auth-mfa)
- Supabase AAL levels: `aal1` = password only, `aal2` = password + second factor

---

## 4. Bachs Webhook Endpoint URL (Requirement 21.19)

### What to configure

The Bachs dashboard must be told where to deliver webhook events. This must point to the
`bachs-webhook` Supabase Edge Function — the only endpoint in this project that is
authorised to mutate coin state (insert `lovecoins` rows and update `purchase_orders`).

### Webhook endpoint URL pattern

```
https://<your-supabase-project-ref>.supabase.co/functions/v1/bachs-webhook
```

For this project the `project_id` is `bufinkvdidqgxmtfmdsu`, so the URL is:

```
https://bufinkvdidqgxmtfmdsu.supabase.co/functions/v1/bachs-webhook
```

### Steps (Bachs Dashboard)

1. Log in to the [Bachs dashboard](https://dashboard.bachs.io).
2. Go to **Developers → Webhooks**.
3. Click **Add endpoint**.
4. Paste the URL above into the **Endpoint URL** field.
5. Under **Events to send**, select at minimum:
   - `collection.succeeded`
   - `collection.failed`
6. Save. Bachs will display a **Webhook Signing Secret** — copy it immediately.
7. Store the signing secret as a Supabase Edge Function secret:
   ```bash
   supabase secrets set BACHS_WEBHOOK_SECRET=<the-secret-from-bachs>
   ```
   Also add it to your `.env` file (never commit `.env` to version control):
   ```
   BACHS_WEBHOOK_SECRET=bachs_whsec_your_webhook_secret_here
   ```

### Why only this endpoint

The `bachs-webhook` Edge Function verifies `X-Bachs-Signature` (HMAC SHA-256 over the raw
request body) before touching the database. No other route in the app mutates coin state.
Exposing any other endpoint as the Bachs webhook destination would bypass this verification
and could allow an attacker to forge payment confirmations.

### Verification

After configuring the webhook, use Bachs's **"Send test event"** feature in the dashboard
to confirm the Edge Function returns HTTP 200 and the Supabase logs show a successful
signature verification.

---

## Summary Checklist

| # | Task | Where | Done? |
|---|------|--------|-------|
| 1 | Enable "Confirm email" | Supabase Dashboard → Auth → Providers → Email | ☐ |
| 2 | Set `site_url` to production domain | Supabase Dashboard → Auth → URL Configuration | ☐ |
| 3 | Add explicit redirect URLs (remove wildcards) | Supabase Dashboard → Auth → URL Configuration | ☐ |
| 4 | Document MFA risk acceptance for MVP | This document (§3) | ✅ |
| 5 | Set Bachs webhook URL to Edge Function URL | Bachs Dashboard → Developers → Webhooks | ☐ |
| 6 | Store `BACHS_WEBHOOK_SECRET` as Edge Function secret | `supabase secrets set` | ☐ |
| 7 | Update `site_url` in `supabase/config.toml` before deploy | `supabase/config.toml` | ☐ |
