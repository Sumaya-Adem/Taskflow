# TaskFlow

TaskFlow is a clean, fast, responsive task management application for organising daily work and personal tasks. It runs entirely in the browser and persists data to `localStorage` — no backend, no account required.

> **Status:** feature-complete. Release documentation is the remaining phase (see [Roadmap](#roadmap)).

## Tech stack

| Area | Choice |
| --- | --- |
| UI | [React](https://react.dev/) 19 (JavaScript) |
| Build tooling | [Vite](https://vite.dev/) |
| Styling | Plain CSS with CSS Modules and design tokens (custom properties) |
| State | React Context + `useReducer` |
| Persistence | Browser `localStorage` (versioned, validated) |
| Testing | [Vitest](https://vitest.dev/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/), jsdom |
| Linting | [ESLint](https://eslint.org/) (flat config) with React Hooks and React Refresh rules |

## Getting started

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- npm 10+

### Install and run

```bash
npm install
npm run dev
```

Then open the URL printed in the terminal (by default <http://localhost:5173>).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server with hot module replacement |
| `npm run build` | Create an optimised production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint the project with ESLint |
| `npm run lint:fix` | Lint and automatically fix fixable issues |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run check` | Run lint, tests, and the production build in sequence |

## Project structure

```
├── index.html            # HTML entry point
├── public/               # Static assets copied as-is (favicon)
├── src/
│   ├── main.jsx          # Entry point: loads storage once, then renders <App>
│   ├── App.jsx           # Providers, error boundary and route → page mapping
│   ├── components/
│   │   ├── dashboard/    # StatCards, CompletionProgress, PriorityBreakdown, DeadlineList
│   │   ├── layout/       # AppShell, Sidebar, NavMenu, AppHeader, PageHeader, Brand, ThemeToggle
│   │   ├── tasks/        # TaskList, TaskItem, TaskForm, TaskFormDialog, TaskToolbar and display helpers
│   │   └── ui/           # Reusable primitives: Button, Icon, Badge, Panel, FormField, Modal,
│   │                     #   ConfirmDialog, Toast (+ useToast), Notice, EmptyState, ErrorBoundary
│   ├── config/           # App configuration: priorities, categories, limits, themes, sort/filter options
│   ├── domain/           # Pure logic: task model, preferences, dates, search/filter/sort, statistics
│   ├── navigation/       # Route definitions and the hash-based router hook
│   ├── pages/            # Dashboard, My Tasks and Settings pages
│   ├── state/            # Task and theme providers, task and view reducers, hooks, storage notices
│   ├── storage/          # localStorage adapter (the only module that touches browser storage)
│   ├── styles/           # Design tokens (light/dark) and global styles
│   └── test/             # Test setup, fixtures, an in-memory Storage mock and render helpers
├── eslint.config.js      # ESLint flat config
└── vite.config.js        # Vite + Vitest configuration
```

The `domain/` and `storage/` layers have no React dependencies, and unit tests sit next to the modules they cover.

## Architecture overview

- **State:** `TasksProvider` (React Context + `useReducer`) holds the task list and persistence status. Components use `useTasks()`, whose actions (`addTask`, `updateTask`, `toggleTaskCompleted`, `deleteTask`) validate input with the domain model and return `{ ok, errors }` results instead of throwing.
- **Persistence:** storage is read once at startup (`createAppServices`), and recovered data is written back once. Every task action writes through to storage synchronously and reports whether it was saved (`{ ok, saved }`), so the UI never shows a failed save as a success: an unsaved change gets a warning message and the storage notice explains what to do. The app keeps working in memory when storage fails.
- **Navigation:** a small hash-based router (`#/dashboard`, `#/tasks`, `#/settings`) built on `useSyncExternalStore`. It needs no server configuration and supports deep links and the back button.
- **Task management:** the My Tasks page lists tasks (newest first) and opens a native `<dialog>` for creating and editing. Forms keep only their own field values; validation and normalization come from the domain layer through the `useTasks()` actions, and errors are shown next to each field. Deleting asks for confirmation in an alert dialog that focuses Cancel first. Feedback appears in a toast announced to screen readers.
- **Search, filters and sorting:** the My Tasks toolbar keeps its settings (query, filters, sort) in a small view reducer in component state. The visible list is derived on each render by the domain pipeline `selectVisibleTasks` (search → filter → sort); view settings are never saved and never change stored tasks. Non-default settings are listed as removable chips, with "Reset all" to return to the defaults.
- **Dashboard:** summary cards, completion progress, a priority breakdown and overdue/upcoming lists, all derived on render from the live task state through domain functions (`computeStats`, `sharePercentage`, `selectOverdueTasks`, `selectUpcomingTasks`). Nothing derived is stored. Creating and editing from the dashboard reuse the same task dialog and `useTasks()` actions as My Tasks.
- **Cross-tab sync:** tabs listen for the browser's `storage` event and reload through the same validating parser. Storage is the shared source of truth and the last write wins. External data is never allowed to silently wipe this tab's tasks: if another tab clears storage, this tab keeps its tasks (and saves them on the next change); if another tab writes unreadable data, it is backed up and this tab's tasks are restored; if a newer app version writes data, this tab stops saving and keeps its tasks in memory. The theme preference syncs too.
- **Theming:** System, Light or Dark, chosen in Settings or toggled from the header. Colors are CSS custom properties defined with `light-dark()`, and a tiny inline script in `index.html` applies a saved choice before first paint.

## Features

- Create, edit, complete/reopen and delete tasks with a title, optional description, priority, category and optional due date
- Overdue, due-today and due-soon tasks are highlighted; completed tasks show when they were finished
- Search titles and descriptions (case- and accent-insensitive, every word must match)
- Filter by status, priority, category and due date (overdue, due today, due soon, no due date), in any combination
- Sort by date created, due date (undated tasks last), priority, title, status or last updated, in either direction
- Dashboard with total/active/completed/overdue counts, completion progress, tasks by priority, and overdue and upcoming deadlines
- Accessible forms (labels, required markers, character counters, inline errors) and keyboard-friendly dialogs
- Light, dark and system themes; responsive layout with a sidebar on desktop and a tab bar on mobile
- Automatic saving in the browser, with clear notices if storage is unavailable, full or corrupted

## Accessibility

- Semantic landmarks, one `h1` per page and no skipped heading levels; a skip link; focus moves to the page heading after navigation
- Every control has an accessible name; form errors are linked to their fields; status (overdue, priority, completion) is always spelled out in text, never color alone
- Native `<dialog>` modals with focus containment, Escape to close and focus restoration; delete confirmation focuses Cancel first
- Text meets WCAG AA contrast and form-control borders meet 3:1 in both themes; interactive targets are at least 24×24 px (most 40–44 px)
- Animations and transitions are disabled when the system asks for reduced motion

## Known limitations

- **Simultaneous edits in two tabs:** the last write wins. If two tabs change tasks at nearly the same moment, before either has received the other's update, the earlier change can be overwritten. Saving a task from an edit dialog writes the dialog's values even if another tab changed that task while the dialog was open.
- Search, filter and sort settings reset when you leave the My Tasks page.
- Due-date states (overdue, due today) are recalculated when tasks change or the page reloads, not automatically at midnight.

## Data storage

Tasks are saved in `localStorage` under `taskflow:tasks` as a versioned envelope:

```json
{ "version": 1, "tasks": [ { "id": "…", "title": "…", "dueDate": "2026-10-08", "…": "…" } ] }
```

- Due dates are local calendar dates (`YYYY-MM-DD`), not timestamps, so they never shift across timezones.
- Every load is validated. Malformed records are repaired where possible (for example, an unknown priority falls back to `medium`) or skipped.
- If stored data is corrupted or had to be repaired, the original is first copied to `taskflow:tasks:backup:<timestamp>` so it is never silently lost.
- Data written by a newer, unsupported schema version is left untouched, and saving is disabled for that session.
- Statistics are always computed from the task list and never stored.
- Preferences (currently the theme) are stored separately under `taskflow:preferences`.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Project scaffold and tooling | ✅ Done |
| 1 | Domain model, validation, and storage layer | ✅ Done |
| 2 | State management, theming, and app shell | ✅ Done |
| 3 | Task create / edit / delete / complete | ✅ Done |
| 4 | Search, filtering, and sorting | ✅ Done |
| 5 | Statistics dashboard | ✅ Done |
| 6 | Responsive, accessibility, and robustness polish | ✅ Done |
| 7 | Documentation and release | Planned |
