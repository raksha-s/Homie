# Homie

A personal house-management app: daily tasks and calendar, meal plans, restocking and expense logging.
Built for one person, free to run, installable on a phone from Chrome.

Live site: https://raksha-s.github.io/Homie/

## Status

Phase 0 and 1: app shell, navigation, light and dark themes, installable web app, automatic deploy, backup.
Features arrive phase by phase; see the roadmap below.

## Roadmap

1. Foundation (this build)
2. My Tasks
3. Calendar and Google Calendar sync
4. Inventory
5. Kitchen meal plans
6. Finance and Google Sheet
7. Polish and accessibility audit

## Run it on your computer

```bash
npm install
npm run dev
```

Then open http://localhost:5173/Homie/ in Chrome.

## Publish changes

Every change pushed to the `main` branch is built and published automatically by GitHub Actions.
You normally ask Claude Code to make a change and push it. Check progress in the repo's Actions tab.

## Secrets

Keys and the private Google Sheet ID are never stored in this code. They live in
GitHub: Settings > Secrets and variables > Actions, and in the app's own private settings.
See `.env.example` for the names. Never commit a file called `.env`.

## Backup, and moving to another GitHub account

```bash
npm run backup
```

This writes `homie-source-<date>.zip` containing all the code with no secrets. Every tagged release
(for example `v0.1.0`) on GitHub also gets this zip attached under Releases.

To host from a different GitHub account: create an empty repo named `Homie`, unzip the backup,
push it, enable Settings > Pages > Source: GitHub Actions, and add the secrets again.
If the repo is renamed, change `base` in `vite.config.ts` to match.
