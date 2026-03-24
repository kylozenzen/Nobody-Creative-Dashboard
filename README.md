# Nobody Studios HQ — Deployment Guide

## File structure
```
ns-hq/
├── index.html                  ← main dashboard
├── netlify.toml                ← Netlify config
└── netlify/functions/
    └── ga4.js                  ← GA4 Data API proxy
```

---

## Deploy to Netlify

1. Push this folder to a GitHub repo (or drag-drop to Netlify)
2. In Netlify dashboard → Site settings → Environment variables, add:

| Variable | Value |
|---|---|
| `GA_CLIENT_EMAIL` | your-service-account@project.iam.gserviceaccount.com |
| `GA_PRIVATE_KEY` | -----BEGIN RSA PRIVATE KEY-----\n... (the full key, paste as-is) |

---

## Google Analytics setup (one-time)

### Step 1 — Create a Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable the **Google Analytics Data API** (search in API Library)
4. Go to **IAM & Admin → Service Accounts → Create Service Account**
5. Name it (e.g. `ns-hq-analytics`), click Create
6. On the service account, go to **Keys → Add Key → JSON**
7. Download the JSON file

### Step 2 — Extract credentials from the JSON
From the downloaded JSON:
- `GA_CLIENT_EMAIL` = the `client_email` field
- `GA_PRIVATE_KEY` = the `private_key` field (the whole thing including `-----BEGIN...-----END-----`)

### Step 3 — Grant GA access
1. Go to [Google Analytics](https://analytics.google.com)
2. Admin → Account Access Management (or Property Access Management)
3. Add the service account email with **Viewer** role

### Step 4 — Find your Property IDs
1. GA → Admin → Property Settings
2. Copy the **Property ID** (numeric, e.g. `123456789`)
3. In the dashboard, open each project → Configure → paste the Property ID

---

## Adding projects
Click **+ new project** in the sidebar. After creation it drops you into Configure automatically.

## Kanban
- **Drag cards** between columns
- **Double-click a column title** to rename it
- **+ add column** for custom workflows per project
- Column structure is saved per-project to localStorage

## localStorage key
All state saves under `ns_hq_v3`. Clear it in DevTools if you need a fresh start.
