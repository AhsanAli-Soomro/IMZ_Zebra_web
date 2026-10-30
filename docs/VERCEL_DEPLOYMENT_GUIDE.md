# Vercel Deployment & Secure License API Guide

Yeh guide aapko batayegi ke kis tarah aap apne Zebra POS License Server ko **Vercel** par deploy kar sakte hain, aur Electron Desktop client ko securely cloud se connect kar sakte hain baghair Neon credentials leak kiye.

---

## Architecture Summary

```
+-------------------------------------------------------------------+
|               ELECTRON DESKTOP POS CLIENT                         |
|  - Local SQLite (ims.sqlite): 100% Offline Sales, Billing & Stock |
|  - Encrypted Local License: license.json                          |
|  - Zero Neon DB credentials in package                            |
|  - 24-Hour Heartbeat + 1-Hour Reconnect Cooldown + Dirty-Check    |
+----------------------------------+--------------------------------+
                                   |
                         HTTPS API (JSON)
                                   v
+-------------------------------------------------------------------+
|             VERCEL HOSTED LICENSE SERVER & ADMIN                  |
|  - Next.js 15 App Router (/admin & /api/license/*)                |
|  - Protected by ADMIN_PASSWORD & APP_LICENSE_SECRET               |
|  - Reusable Services Layer (services/licenseService.js)           |
+----------------------------------+--------------------------------+
                                   |
                  @neondatabase/serverless (HTTP)
                                   v
+-------------------------------------------------------------------+
|                     NEON POSTGRESQL CLOUD                         |
|  - system_licenses table (Customers, Keys, Limits, Permissions)   |
|  - Auto-suspend intact (Compute CU usage saved < 2 CU-hrs/mo)     |
+-------------------------------------------------------------------+
```

---

## Step 1: Vercel par Project Setup

1. [vercel.com](https://vercel.com) par login karein.
2. **Add New Project** par click karke apni repository connect karein.
3. **Framework Preset**: `Next.js` select karein (Vercel automatically detect karega).
4. **Build Command**: `npm run build:web`
5. **Output Directory**: `.next` (default)
6. **Environment Variables** add karein:
   - `NEON_DATABASE_URL`: `postgresql://neondb_owner:npg_wGX0m6fYKLyO@ep-small-smoke-b5a3it1v-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require`
   - `APP_LICENSE_SECRET`: `hrc-ims-zebra-prod-secret-98234-x89f-2026`
   - `ADMIN_PASSWORD`: Apna secret password (e.g. `habib2026` ya koi aur strong password)
   - `VERCEL`: `1` (Vercel automatically sets this)

7. **Deploy** par click karein. Deploy hone ke baad Vercel aapko ek URL dega (e.g., `https://imz-zebra-web.vercel.app`).

---

## Step 2: Vercel Hobby vs Pro Plan

- **Vercel Hobby (Free)**:
  - Personal development, internal staging aur testing ke liye best hai.
  - Commercial business terms ke mutabiq commercial use ke liye **Vercel Pro** ($20/mo) recommend kiya jata hai.
  - Neon ka auto-suspend 5 minutes par active rahega kyunki heartbeat 24 ghante par shift ho chuki hai. Neon free plan ke 100 CU-hours mein se 2 CU-hours se bhi kam compute use hoga!

---

## Step 3: Desktop POS Client ko Vercel se Link Karna

Jab aapka Vercel deployment live ho jaye:

1. Apne Desktop environment ya `.env` file mein:
   ```env
   LICENSE_SERVER_URL=https://your-app-name.vercel.app
   NEXT_PUBLIC_LICENSE_API_URL=https://your-app-name.vercel.app
   ```
2. Electron build create karein:
   ```bash
   npm run dist
   ```
   *Note: Electron package mein Neon connection string nahi jayegi, isliye koi bhi user ya competitor database credentials extract nahi kar sakega.*

---

## Step 4: Verification & Testing Checklist

- [x] **Branding Intact**: Habib Rice Corporation logo (`public/logo/company-logo.png`) aur icons safe hain.
- [x] **Offline POS 100% Intact**: Internet disconnect karne par bhi Billing, SQLite sales, stock, aur receipts print hoti rahengi.
- [x] **Dirty-Check Enabled**: Unchanged data baar baar Neon par write nahi hoga.
- [x] **24-Hour Heartbeat**: 15 minute ke bajaye har 24 ghante baad sync hoga.
- [x] **1-Hour Reconnect Cooldown**: Bar bar internet aane-jane par spamming nahi hogi.
- [x] **Admin Panel Working**: `/admin` par secure login se licenses manage kiye ja sakte hain.

