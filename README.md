# Expense Tracker

A privacy-first personal finance dashboard for tracking daily spending, income, budgets, and trends — no backend, no sign-up, no account required. Everything runs in your browser and stays on your device.

**Live app:** https://ogomjot.github.io/expense-tracker/

## Features

- **Transaction CRUD** — add, edit, and delete income and expense entries
- **Import bank/UPI statements** — drop in a CSV export from Paytm, Google Pay, PhonePe, or a generic bank statement and it's parsed automatically, with a preview step so you can double-check (and deselect) rows before anything gets saved. Built this because typing in every transaction by hand was the biggest reason I kept abandoning my own tracker.
- **Custom categories** for both income and expense tracking
- **Budget management with live alerts** — set a spending limit per category and get warned as you approach and cross it (80% and 100% thresholds), with a color-coded progress bar so you can see it at a glance instead of finding out at month-end
- **CSV export** for filtered transaction data
- **JSON backup and restore** with import validation, so your data is portable and never locked in
- **Dark mode and light mode** themes
- **Multi-currency display formatting** using locale-aware currency symbols (this changes how numbers are displayed, not real exchange conversion — see limitations below)
- **Charts** powered by Chart.js for category breakdowns and monthly trend analysis

## Tech stack

Vanilla HTML/CSS/JavaScript — no framework, no build step, no bundler. Chart.js is the only external dependency and is loaded via CDN.

This was a deliberate choice, not a limitation I ran into. Keeping the app framework-free means the whole thing is auditable in a handful of plain files — no build pipeline to trust, no dependency tree to worry about, and nothing hidden behind a framework's lifecycle. For a personal finance tool, being able to actually read every line that touches your data felt more important than developer convenience.

## Why no backend

All data lives in `localStorage`. Nothing leaves your browser unless you explicitly export a file yourself. No server means no account to hack, no database to leak, and no reason to trust me with your spending habits — which is the whole pitch.

## Getting started

1. Clone the repository.
2. Open `index.html` directly in a browser, or serve the folder with any static server (e.g. `npx serve .`) if you'd rather load it over local HTTP.

That's it — no install step for the app itself.

## Running the tests

```bash
npm install
npm test
```

Test coverage includes totals calculation, transaction filtering, CSV parsing/escaping (both export and import), and backup validation.

## Project structure

```text
.
├── index.html              # Landing page and marketing content
├── main.html               # Main app dashboard and controls
├── main.css                # Shared styling, layout, and theme rules
├── app.js                  # Core app logic: transactions, budgets, storage, exports, Chart.js integration
├── csv-import.js           # Statement import: format detection, parsing, and normalization for bank/UPI CSVs
├── scroll-fx.js            # Small front-end interaction/scroll script
├── expense-logic.test.js   # Vitest test suite
├── package.json            # Dev-only test configuration
├── package-lock.json       # Locked dependency versions for the dev/test tooling
├── project.md               # Extra project notes and design context
├── robots.txt               # Search engine crawl rules
├── sitemap.xml               # Site map for search indexing
└── README.md                  # This file
```

## Known limitations

- Currency switching changes display formatting only — it does not convert values between currencies.
- Tailwind is loaded via the Play CDN for zero-build simplicity. That's fine for a lightweight personal project, but not what you'd want for a production deployment at scale (Tailwind itself will warn you about this in the console — it's expected, not a bug).
- All data is local to the browser/device it's entered on. There's no sync between devices by design — use the JSON backup/restore feature if you need to move your data somewhere else.

## License

MIT
