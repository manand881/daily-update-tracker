# Daily Update Tracker

A desktop app built with Electron for tracking daily work updates.

## Features

### Daily Updates
- Log structured work updates for any day with these fields:
  - **What I did** — rich text editor with bold, italic, and underline formatting
  - **Repos / projects** — comma-separated list of repos or projects touched
  - **Why** — context or motivation behind the work
  - **Impact** — outcome or business value
  - **Who I worked with** — tag collaborators using `@mention`
  - **Impediments** — blockers or issues encountered
- Edit or delete existing updates
- Only non-empty fields are shown on the update card

### Calendar
- Multi-month calendar view — shows 4 months at once, scrolling back from the current month
- Navigate forward/backward by month with prev/next buttons
- Days with logged updates are marked with a dot
- Today is visually highlighted
- Click any day to view or log updates for that date
- Selected day is highlighted

### Holiday Management
- Mark any day as a holiday with a custom name
- Mark a date range as holidays (weekends are automatically skipped)
- Holidays appear with a distinct color on the calendar
- Remove holidays with one click

### People / Collaborators
- Maintain a reusable list of people
- Tag collaborators in the "Who I worked with" field by typing `@`
- Autocomplete dropdown filters as you type
- Add new people on the fly from the same dropdown — they're saved for future use
- Remove tags with the × button or by pressing Backspace

### Export
- Export all updates, holidays, and people to a JSON file via **Settings → Export JSON**

## Tech Stack

- [Electron](https://www.electronjs.org/) — desktop app framework
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — local SQLite database
- Vanilla HTML / CSS / JavaScript

> **Note:** This project intentionally uses only vanilla HTML, CSS, and JavaScript. Do not introduce any frontend frameworks (React, Vue, etc.), CSS preprocessors, or bundlers.

## Color Scheme

| Name | Hex | Usage |
|---|---|---|
| Prussian Blue | `#102542` | Primary background |
| Vibrant Coral | `#f87060` | Primary actions, focus rings, CTAs |
| Warm Amber | `#d99152` | Field labels, required indicators, active toolbar state |
| Alabaster Grey | `#cdd7d6` | Body text, card content |
| Khaki Beige | `#b3a394` | Secondary text, icons, labels |
| White | `#ffffff` | Headings, input text |
| Slate Green | `#5b756c` | Reserve |
| Deep Charcoal | `#2d3142` | Reserve |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22 (LTS)
- npm

### Running the App

```bash
# Production
npm start

# Development (auto-restarts on file changes)
npm run dev
```

## License

MIT
