# Homie: Build Plan (v2)

A personal house-management web app (installable on your phone, works in desktop Chrome). Five tabs: My Tasks and Calendar (Main), Kitchen, Inventory, Finance.

Changes since v1: Google account is your personal Gmail, the Sheet ranges are fixed, the Pulav example is fixed, "days left" is an example only, and the design rules for mobile and accessibility are now part of the plan.

## 1. Design read

Reading this as: a personal daily-use mobile app for one person, with a calm, clear, high-contrast language, leaning toward Tailwind v4 + Radix primitives + Geist, built phone-first.

The design guidance I'm using is for marketing pages, so I apply only the parts that fit an app: one accent colour, no AI-purple, no Inter default, a single corner-radius system, real loading/empty/error states, light and dark mode, and a self-hosted font. I ignore its landing-page rules (heroes, bento, marquees).

| Dial | Value | Why |
|---|---|---|
| Variance | 3 | Predictable, familiar layouts. You use this daily. |
| Motion | 3 | Only feedback and state changes. Nothing decorative. |
| Density | 5 | Task lists and tables need to be scannable. |

Rules I'll hold to:
- **Typography:** Geist (self-hosted), 16px minimum for body and inputs.
- **Colour:** one accent (deep teal), neutral greys, off-black and off-white, never pure black or white. Category colours come from one validated palette. Colour is never the only signal (see Calendar).
- **Shape:** one radius scale (cards 16px, controls 12px, pills full).
- **Icons:** Phosphor only. Your expense-type emojis are kept exactly as you wrote them, since they're your data. No other emoji in the interface.
- **Copy:** plain and functional. No em-dashes.

## 2. Mobile-native rules (baked in from day one)

These are the things that make a web app feel like a phone app. They go in before the first screen:
- `viewport-fit=cover` with safe-area padding on the bottom nav, floating add button and sheets.
- `100dvh` for the app shell, so the browser address bar doesn't hide the bottom nav.
- No sticky hover: all hover styles are gated to mouse devices. Every tappable thing has a pressed state.
- No grey tap flash, `touch-action: manipulation` on buttons, no text selection on controls (still selectable in content).
- Inputs at 16px or larger so iOS doesn't zoom. Amount field uses the decimal keypad.
- `overscroll-behavior` set so a bottom sheet scrolling doesn't pull-to-refresh the page.
- `theme-color` for light and dark; installable manifest.
- Testing on your real phone, not only desktop emulation. I'll say clearly which checks need your phone.

## 3. Architecture (all free)

| Concern | Choice |
|---|---|
| App | React + TypeScript + Vite, installable PWA |
| Styling | Tailwind v4 + Radix UI primitives (accessible sheets, dialogs, selects) |
| Hosting | GitHub Pages via GitHub Actions (free). The repo can be public. |
| Data | Supabase free tier (open-source Postgres). Row-level security locks every table to your account only. |
| Sign-in | Google sign-in with your personal Gmail. Only that email is allowed. |
| Calendar and Sheets | Called straight from your browser with your own Google permission (scopes: `calendar.events`, `spreadsheets`). No server and no stored secrets. |
| Meal plan | Rules engine first (see Phase 5), optional free Gemini pass later through a Supabase Edge Function so the key never reaches the browser. |
| Reminders | In-app, plus a badge. Phone push notifications are a later option. |

**Using your personal Gmail** removes the office-admin risk I raised. Two things remain:
- Google shows an "unverified app" warning for personal apps using Calendar and Sheets. That is expected for a private app. You add yourself as a "test user" once.
- Google access from a browser lasts about an hour. Homie will reconnect quietly when needed, and may ask you to tap "Connect Google" now and then. Saved entries are never lost when that happens.

**Secrets and privacy**
- The repo holds no keys, no Sheet link, no Sheet ID. Those live in GitHub Secrets (for the build) and in your private settings row.
- The Sheet stays private to your Google account. The app gets access only through your own sign-in.
- Please confirm the Sheet is owned by (or shared as Editor with) your personal Gmail. If it sits in your office account, I'd have you make a copy in your personal Drive first, because your office account may block the connection.

**Backup, so you never lose the source**
- `npm run backup` creates `homie-source-<date>.zip` (code, database migrations, setup notes, no secrets).
- A GitHub Action attaches the same zip to every release.
- Settings has "Export my data" (tasks, foods, inventory, expenses as JSON).
- Recommendation: create the GitHub repo under your personal GitHub account from the start, so there is nothing to move later. The zip is the safety net either way.

## 4. Data model (Supabase, every table locked to your user)

- `tasks`: title, category (`routine | reminder | restock | birthday | goal`), time, start_date, recurrence (JSON: type, days, end_date or indefinite), add_to_gcal, gcal_event_id, source (`manual | inventory | meal_plan | gcal`), source_ref, target (goals).
- `task_occurrences`: task, date, status (`pending | done | skipped`), time_override. Recurring tasks are expanded on read. A row is written only when something changes.
- `foods`: type (`fruit | snack | dish`), name, meals[], preferences[].
- `meal_plans`, `meal_plan_items`: week_start, status (`draft | published`), date, meal, food.
- `inventory_items`, `restocks`: item, restock_date, over_on, linked task.
- `expense_sessions`, `expenses`: amount (numeric 12,2), name, date, bank, category, type, session, submitted_at.
- `settings`: Sheet ID, month-to-gid map, Google sync timestamps.

## 5. Phases

**Phase 0: Setup (I give you one click-by-click step at a time)**
Create the GitHub repo, Supabase project, and Google Cloud project (Calendar API, Sheets API, OAuth consent screen with you as test user). Add a deploy action.
Done when: a "Hello Homie" page is live and installs on your phone.

**Phase 1: Foundation**
App shell, bottom nav, floating add button, bottom sheet, tokens, light and dark mode, sign-in, database migrations, backup script, README with "how to ask Claude Code for a change and publish it".

**Phase 2: My Tasks**
- Day view that opens on Today, with a "Today" button on other days.
- Add sheet: name, category, frequency (hidden for Birthdays), time, "Add to Google Calendar" (on and locked for Birthdays), "Pick manually" for taken slots.
- Frequencies: Today, Tomorrow, Every week on [day], Daily, Weekdays, Weekends, Alternate day, Alternate weekday, Twice a week, Monthly. All except Today/Tomorrow end with "Until [date]" or "Indefinitely".
- Free-slot picker (6:00 to 23:00, 30-minute steps by default). A manual override allows exactly two tasks at one time.
- Card: name, category badge (none for routine), S M T W T F S strip for recurring, time, Done. Tap the card for Skip / Modify / Delete. Tap again to close.
- Long-press drag changes the time within the same day only. For recurring tasks only that day's time changes.
- Reminders, Birthdays, Goals: a clearly distinct look. Goals carry a target.
- Restock tasks roll over to the next day until done.

**Phase 3: Calendar and Google Calendar**
- Week, month, year views. Each day shows coloured dots and a completion percentage as text.
- Tap a day to open My Tasks on that date. Add a task from the calendar by tapping the day, then "Add task".
- On save, tasks with the box ticked go to your Google Calendar. Birthdays always do.
- "Sync from Google Calendar": a manual button in the Calendar plus a recurring Sunday task. Imported events are matched by event ID so nothing doubles.

**Phase 4: Inventory**
- Table: item, previously restocked, Mark as over / Mark as restocked, Undo, days lasted with a prediction.
- Mark as over creates a Restock task for the coming Saturday.
- Mark as restocked, from Inventory or from the task, always asks for the restock date first (calendar-style picker, default today).
- Days lasted = this restock date minus the previous restock date. Prediction: last restock + days lasted, shown as "about N days left". Your table values were examples only, so I'm not matching those dates.
- An item with only one restock shows "Needs one more restock to predict".

**Phase 5: Kitchen**
- Add fruit, snack or dish, with the meal multi-select and the seven preference options.
- "Make meal plan": choose meals per day, then generate from now to Saturday night (Sunday morning gives the full week, Sunday 11 AM starts that afternoon, Wednesday starts Wednesday).
- Rules: fruit every day, dishes only in the meals you allowed, reuse a dish across at least two meals a day to cut cooking, long-to-make dishes land on weekends, weights 50% nutrition, 20% likability, 30% effort. Fruits and snacks have no meal tags, so they can sit alongside any meal.
- Review with dropdown swaps, then Publish. Publishing creates routine tasks at 7:00, 12:00, 17:00, 20:00. No recipes anywhere.
- Your example (Pulav, Maggi, boiled eggs, banana, pumpkin seeds) becomes an automated test that must produce: Breakfast eggs + fruit, Lunch Pulav + pumpkin seeds, Snack Maggi, Dinner Pulav.

**Phase 6: Finance and Google Sheets**
- Two top tabs: EXPENSE FORM and SESSION LOGS.
- Form: amount in rupees with 2 decimals, name (emoji allowed), date (Today/Yesterday shortcuts, defaults to today), bank pills (ICICI Bank, Federal Bank, Kotak Bank, Amazon Pay ICICI, Cash), category pills, expense-type dropdown (your list). Save enables when all fields are filled.
- Session logs: each unsubmitted session is its own editable table, newest first, each with a green "Submit to Google Sheet". A summary modal confirms with Submit and Cancel. Submitted sessions disappear.
- Sheet writing, fixed rules:
  - Tab = month of the payment date, from the gid list (Oct 2026 to Dec 2027). A date outside that range is blocked with a clear message.
  - Wants B41:F164, Recurring H41:L164, Needs N41:R164, Savings T41:X164, Credit Card/EMIs Z41:AD164.
  - Each block's 5 columns, in order: expense name (under the category heading, e.g. WANTS), amount, expense type, bank account, date of payment. For Wants that is B name, C amount, D type, E bank, F date. The other four blocks use the same order starting at H, N, T and Z.
  - Read the range, find the first fully empty row, and write only that one row's 5 cells. Nothing else in the sheet is touched. If the range is full, the entry stays in the session log and you see why.
  - A dry-run mode and a test copy of the Sheet are used during development, so your real salary sheet is never touched while testing.

**Phase 7: Hardening**
WCAG 2.2 AA audit, keyboard and screen-reader pass, real-phone testing, error and offline states for every screen, and one week of real use before calling it done.

## 6. Accessibility decisions (WCAG)

- **Blinking reminders:** a slow pulse well under 3 per second, with a "Silence" control, so it can be stopped. With reduced-motion on, it becomes a static highlighted border plus the badge. The "beeping" badge pulses visually. Sound is off by default (browsers block it anyway) and can be turned on in Settings.
- **Drag to reschedule:** also available as "Change time" in the card actions, because dragging alone isn't accessible.
- **Calendar dots:** each day also shows the number of tasks and the percentage as text, so colour is never the only signal.
- Touch targets at least 44px, visible focus rings, labelled controls, errors shown inline below inputs, contrast at AA or better in both light and dark.

## 7. Testing

- Automated tests for the parts that must never be wrong: recurrence, free-slot scheduling, meal planner (including your example), days-lasted and prediction, month-tab and range picking, and next-empty-row writing.
- Accessibility checks on each screen.
- Real-phone checks for the mobile items in section 2.

## 8. What I still need from you

Resolved: column order (name, amount, expense type, bank, date), Sheet is in your personal Drive, and the repo is https://github.com/raksha-s/Homie.

Still to confirm in Phase 6: that the Sheet's date and amount columns accept values typed as text the way the Sheet UI would (checked on the test copy first).

Defaults I'm assuming unless you change them:
- Milestone category is called **Goals** (a deadline plus an optional progress target).
- Dot percentage = done divided by (all minus skipped).
- Editing a recurring task asks "this day only" or "this and future days".
- Imported Google Calendar events become Reminders.
- Sunday sync task at 7:00 AM.
- Meal tasks can be skipped or moved.
- Meal plan: rules engine first. Free Gemini pass is optional later.
- Reminders are in-app only for now.

## 9. Skills not installed (optional)

- `brainstorming`, `writing-plans`: `/plugin install superpowers@claude-plugins-official`
