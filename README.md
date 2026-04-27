# Finance Manager

A simple, offline-first React PWA that imports CSV bank exports from German banks and visualizes account balances over time, with a future prognosis. Everything runs **locally in your browser** — nothing is uploaded.

## Features

- **CSV import** with bank presets for Sparkasse, VR-Bank/Volksbank, Postbank, Commerzbank, plus a **custom** mode.
- **Configurable column mapping**, delimiter, encoding (UTF-8 / ISO-8859-1 / …), decimal separator, and date format — all editable per import.
- **Multiple accounts**: view each one separately or all of them combined with a total line.
- **Line chart** with selectable timespan (1M / 3M / 6M / 1Y / All).
- **Future prognosis** based on the trailing 6 months — toggle between **linear regression** (with confidence band) and **average net change**, horizon up to 24 months.
- **PWA**: installable, works offline after first load.
- **Local-only**: data is persisted in IndexedDB. JSON export/import for backups.

## Tech stack

Vite · React 18 · TypeScript · Tailwind CSS v4 · Recharts · PapaParse · date-fns · idb-keyval · Zod · vite-plugin-pwa.

## Develop

```bash
npm install
npm run dev          # dev server with HMR
npm run test         # run unit tests
npm run build        # type-check + production build
npm run preview      # preview the production build (test PWA)
```

## Deploy to GitHub Pages (free)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the app and publishes to GitHub Pages.

**One-time setup** (after the first workflow run):

1. Open the repo on GitHub → **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.

The site will then be served from `https://<your-user>.github.io/Finance-Manager-/`. The Vite `base` is set to `/Finance-Manager-/` for production builds.

If you fork or rename the repo, update `repoBase` in `vite.config.ts` to match the new path.

## Bank CSV notes

| Bank | Delimiter | Encoding | Has running balance? |
|---|---|---|---|
| Sparkasse | `;` | ISO-8859-1 | Yes (`Saldo nach Buchung`) |
| VR-Bank | `;` | UTF-8 | No (derive from starting balance) |
| Postbank | `;` | UTF-8 | No (derive from starting balance) |
| Commerzbank | `;` (or `,`) | UTF-8 | No (derive from starting balance) |

When the export has no running balance, set the account's **starting balance** to whatever your account had **before** the first transaction in the CSV — the app rolls forward from there.

## License

MIT — see `LICENSE`.
