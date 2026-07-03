# Genie Coverage Dashboard — Allegiance Real Estate

A web dashboard showing everything Genie Map covers across the UAE — for internal use by the Allegiance team.

## What it shows

- **7 UAE Emirates** with district counts
- **403 Districts** — searchable, filterable by emirate
- **533 Active Developers** ranked by project count (Emaar, DAMAC, Sobha, etc.)
- **8 Property types** — Apartments, Villas, Townhouses, and more
- **18 Bedroom configurations** — Studio through 13BR
- **169 Amenities** tracked on listings
- **Finish levels**, **special features**, **building configuration types**

## How to run

```bash
# Install (only once)
npm install

# Start the server
npm start
```

Then open **http://localhost:3000** in your browser.

Log in with the Genie credentials. The dashboard loads all coverage data automatically.

## Sharing with the team

If the team is on the **same network** (WiFi/LAN), they can access the dashboard by:

1. Find your machine's local IP:  `ipconfig getifaddr en0`
2. Share the URL: `http://<your-ip>:3000`

For remote sharing, deploy this to any Node.js host (Railway, Render, Fly.io — all free tiers work).

## Tech

- **Backend**: Node.js + Express (proxy to Genie API, handles auth)
- **Frontend**: Vanilla JS + Tailwind CSS + Chart.js
- No build step required
