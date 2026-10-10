# TaskFlow

TaskFlow is a clean, fast, responsive task manager for everyday work and personal tasks. It runs entirely in your web browser: tasks are saved in the browser's `localStorage`, so there is no server, no database and no account to create.

> **Status:** version 1.0.0, ready for deployment as a static website. See [CHANGELOG.md](CHANGELOG.md) for release notes.

> **Your data stays in your browser.** Tasks are stored only in the browser and device where you created them. They do not sync between devices or browsers, and clearing your browser's site data deletes them. TaskFlow has no accounts, cloud sync or backend.

## Contents

- [Features](#features)
- [Technologies](#technologies)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Testing and linting](#testing-and-linting)
- [Production build](#production-build)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Data storage and persistence](#data-storage-and-persistence)
- [Accessibility](#accessibility)
- [Browser support](#browser-support)
- [Known limitations](#known-limitations)

## Features

**Tasks**
- Create, edit, complete, reopen and delete tasks
- Each task has a title (required, up to 120 characters), an optional description (up to 1,000 characters), a priority (high, medium, low), a category (work, personal, shopping, health, other) and an optional due date
- Clear validation messages next to each field; deleting asks for confirmation
- Overdue, due-today and due-soon tasks are highlighted, with the status written out in text; completed tasks show when they were finished

**Finding tasks (My Tasks page)**
- Search titles and descriptions (ignores capitals and accents; every word must match)
- Filter by status (all, active, completed), priority, category and due date (overdue, due today, due soon, no due date), in any combination
- Sort by date created, due date (tasks without a date last), priority, title, status or last updated, in either direction
- Active filters appear as removable chips, with "Reset all" to return to the defaults

**Dashboard**
- Total, active, completed and overdue counts
- Overall completion percentage with a progress bar
- Tasks by priority
- Lists of overdue and upcoming tasks; select a task to edit it

**Everyday use**
- Light, dark and system themes
- Responsive layout: sidebar navigation on desktop, bottom tab bar on mobile
- Automatic saving, with clear messages if a change could not be saved
- Changes made in one browser tab appear in other open TaskFlow tabs

## Technologies

| Area | Choice |
| --- | --- |
| UI | [React](https://react.dev/) 19, JavaScript |
| Build tool | [Vite](https://vite.dev/) 8 |
| Styling | Plain CSS with CSS Modules and design tokens (CSS custom properties) |
| State | React Context and `useReducer` |
| Persistence | Browser `localStorage` (versioned and validated) |
| Testing | [Vitest](https://vitest.dev/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/), jsdom |
| Linting | [ESLint](https://eslint.org/) 10 (flat config) with React Hooks and React Refresh rules |

The only runtime dependencies are `react` and `react-dom`.

## Getting started

### Prerequisites

- **Node.js** `^20.19.0` or `>=22.12.0` (as declared in `package.json` → `engines`). Node 22 LTS is recommended; the repository includes an `.nvmrc` file, so `nvm use` selects it.
- **npm** 10 or newer (bundled with those Node versions)

### Installation

```bash
git clone https://github.com/Sumaya-Adem/Taskflow.git
cd Taskflow
npm ci          # installs the exact versions from package-lock.json
```

`npm install` also works; `npm ci` is preferred because it uses the lockfile exactly.

### Run locally

```bash
npm run dev
```

Open the URL printed in the terminal (by default <http://localhost:5173>). The page reloads automatically as you edit files.

No environment variables or configuration files are needed.

## Available scripts

These are the scripts defined in `package.json`:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite development server with hot reloading |
| `npm run build` | Create an optimised production build in `dist/` |
| `npm run preview` | Serve the production build from `dist/` locally (run `npm run build` first) |
| `npm run lint` | Check the code with ESLint |
| `npm run lint:fix` | Check the code and automatically fix what can be fixed |
| `npm test` | Run the test suite once (`vitest run`) |
| `npm run test:watch` | Run tests in watch mode while you work |
| `npm run check` | Run lint, tests and the production build, one after another |

## Testing and linting

```bash
npm test                         # run all tests once
npx vitest run --maxWorkers=1    # run all tests in a single worker
npm run test:watch               # re-run tests when files change
npm run lint                     # lint all files
```

If tests fail to start with worker start-up timeouts (this has happened on slower or heavily loaded machines), use `npx vitest run --maxWorkers=1`, which runs the test files one after another.

The test suite contains unit tests for the domain and storage layers and integration tests that render the full app over an in-memory storage, so tests never touch your real browser data. Tests live next to the code they cover (`*.test.js` / `*.test.jsx`).

## Production build

```bash
npm run build      # outputs static files to dist/
npm run preview    # serves dist/ at http://localhost:4173
```

The build produces a fully static site: `dist/index.html`, `dist/favicon.svg` and one hashed JavaScript and CSS file in `dist/assets/`. Any static file host can serve it.

## Deployment

TaskFlow is a static single-page app, so it can be hosted on any static hosting provider. Two common free-tier options are described below. **Nothing has been deployed yet**; these are the steps to do it yourself.

| Setting | Value |
| --- | --- |
| Install command | `npm ci` (or the provider's default `npm install`) |
| Build command | `npm run build` |
| Output / publish directory | `dist` |
| Node.js version | 22 (or any version allowed by `engines`) |
| Environment variables | None required |
| Rewrite rules | None required (see below) |

### Vercel

1. Push the branch you want to deploy to GitHub (production deployments usually use `main`).
2. Sign in at <https://vercel.com> with GitHub and choose **Add New → Project**.
3. Import the `Taskflow` repository. Vercel detects **Vite** automatically.
4. Check the settings: build command `npm run build`, output directory `dist`. Leave environment variables empty.
5. Select **Deploy**. Vercel builds the site and gives you a `*.vercel.app` URL. Later pushes to the production branch redeploy automatically, and pull requests get preview URLs.

### Netlify

1. Push the branch you want to deploy to GitHub.
2. Sign in at <https://app.netlify.com> with GitHub and choose **Add new site → Import an existing project**.
3. Pick GitHub and the `Taskflow` repository, then the branch to deploy.
4. Set **Build command** to `npm run build` and **Publish directory** to `dist`. Netlify reads `.nvmrc` to choose the Node version.
5. Select **Deploy**. Netlify gives you a `*.netlify.app` URL and redeploys on every push to that branch.

### Routing and rewrite rules

TaskFlow uses hash-based URLs (`/#/dashboard`, `/#/tasks`, `/#/settings`). The part after `#` is handled in the browser and never sent to the server, so the host only ever serves `/index.html`. **No redirect or rewrite rule is needed** on Vercel, Netlify or similar hosts, and refreshing on any page or opening a bookmarked page works.

### Hosting under a sub-path (for example GitHub Pages)

The build assumes the site is served from the root of a domain (`/`). If you host it under a sub-path, such as GitHub Pages at `https://<user>.github.io/Taskflow/`, add `base: '/Taskflow/'` to the object passed to `defineConfig` in `vite.config.js` before building. Vercel and Netlify need no change.

### After deploying

Open the site, create a task, reload the page and check that the task is still there. Remember that every visitor's tasks are stored only in their own browser.

## Project structure

```
├── index.html            # HTML entry point (includes a tiny pre-paint theme script)
├── public/               # Static files copied as-is (favicon)
├── src/
│   ├── main.jsx          # Entry point: loads storage once, then renders <App>
│   ├── App.jsx           # Providers, error boundary and route → page mapping
│   ├── components/
│   │   ├── dashboard/    # StatCards, CompletionProgress, PriorityBreakdown, DeadlineList
│   │   ├── layout/       # AppShell, Sidebar, NavMenu, AppHeader, PageHeader, Brand, ThemeToggle
│   │   ├── tasks/        # TaskList, TaskItem, TaskForm, TaskFormDialog, TaskToolbar and display helpers
│   │   └── ui/           # Reusable pieces: Button, Icon, Badge, Panel, FormField, Modal,
│   │                     #   ConfirmDialog, Toast (+ useToast), Notice, EmptyState, ErrorBoundary
│   ├── config/           # App configuration: priorities, categories, limits, themes, sort/filter options
│   ├── domain/           # Pure logic: task model, preferences, dates, search/filter/sort, statistics
│   ├── navigation/       # Route definitions and the hash-based router hook
│   ├── pages/            # Dashboard, My Tasks and Settings pages
│   ├── state/            # Task and theme providers, reducers, hooks, storage notices
│   ├── storage/          # localStorage adapter (the only module that touches browser storage)
│   ├── styles/           # Design tokens (light/dark) and global styles
│   └── test/             # Test setup, fixtures, an in-memory Storage mock and render helpers
├── .nvmrc                # Recommended Node.js version for nvm and hosting providers
├── eslint.config.js      # ESLint configuration
├── vite.config.js        # Vite and Vitest configuration
├── CHANGELOG.md          # Release notes
└── package.json          # Scripts and dependencies
```

## Architecture

TaskFlow is organised in layers. Each layer only depends on the ones below it.

```
pages & components  →  state (Context + reducers)  →  domain (pure functions)  →  storage adapter (localStorage)
```

- **Domain (`src/domain/`):** plain JavaScript with no React. It defines the task model, validation, date handling, search/filter/sort and statistics. Business rules live here only.
- **Storage (`src/storage/`):** the only code that reads or writes `localStorage` (apart from the small theme script in `index.html`). Every read is validated; every function returns a result instead of throwing.
- **State (`src/state/`):** `TasksProvider` (React Context + `useReducer`) holds the tasks and the save status. Components call `useTasks()`, whose actions (`addTask`, `updateTask`, `toggleTaskCompleted`, `deleteTask`) validate input with the domain model and return `{ ok, saved }` or `{ ok: false, errors }`. Each change is saved immediately, so the UI always knows whether it was actually stored.
- **Navigation (`src/navigation/`):** a small hash-based router built on `useSyncExternalStore`, with deep links and back/forward support and no router library.
- **UI (`src/components/`, `src/pages/`):** presentational components. Search/filter/sort settings live in local component state and are never saved. Dashboard figures are derived from the current tasks on every render and never stored.
- **Cross-tab sync:** each tab listens for the browser's `storage` event and reloads tasks through the same validating parser (see below for how conflicts are handled). The theme preference syncs too.
- **Theming:** colours are CSS custom properties defined with `light-dark()`; the theme can follow the system or be set to light or dark.

## Data storage and persistence

- Tasks are saved in `localStorage` under the key `taskflow:tasks` as a versioned record:

  ```json
  { "version": 1, "tasks": [ { "id": "…", "title": "…", "dueDate": "2026-10-08", "…": "…" } ] }
  ```

- The theme preference is stored separately under `taskflow:preferences`.
- **Local only:** `localStorage` belongs to one browser profile on one device and one site address. Tasks do not move between devices, browsers, browser profiles or different site URLs (for example `localhost` and your deployed domain have separate data). Private/incognito windows usually discard data when closed, and clearing site data deletes all tasks.
- **Saving:** every change is written immediately. If saving fails (storage full, blocked by privacy settings), the change stays visible in the current tab, a warning says it was not saved, and a notice explains what to do.
- **Validation and recovery:** stored data is checked every time it is loaded. Damaged records are repaired where possible (for example, an unknown priority becomes `medium`) or skipped. Before anything damaged is replaced, the original is copied to a backup key (`taskflow:tasks:backup:<timestamp>`) in the same browser storage, so nothing is silently lost.
- **Newer versions:** data written by a newer version of TaskFlow is never overwritten; saving pauses and a notice asks you to reload.
- **Due dates** are stored as calendar dates (`YYYY-MM-DD`), not timestamps, so they do not shift between time zones.
- **Several tabs:** storage is the shared source of truth and the most recent save wins. If another tab clears the stored tasks, this tab keeps showing its tasks and saves them again on the next change. If another tab writes unreadable data, it is backed up and replaced with this tab's tasks. If a newer app version writes data, this tab stops saving and keeps its tasks in memory.
- Statistics and search/filter/sort settings are never stored.

## Accessibility

- Semantic landmarks, one main heading per page, no skipped heading levels, and a "Skip to main content" link
- Every button, link and form field has an accessible name; form errors are linked to their fields
- Status (overdue, priority, completion) is always written out, never shown by colour alone
- Native `<dialog>` dialogs keep focus inside, close with Escape and return focus afterwards; delete confirmation focuses **Cancel** first
- Text meets WCAG AA contrast and form-control borders meet 3:1 in both themes; touch targets are at least 24×24 px (most are 40–44 px)
- Animations and transitions are turned off when the system requests reduced motion

These were checked with automated tests and scripted checks in Chromium. TaskFlow has not yet been tested with a real screen reader or on physical touch devices.

## Browser support

TaskFlow targets current versions of Chrome, Edge, Firefox and Safari. It relies on modern CSS (`light-dark()`, `:has()`, `color-mix()`), available in browsers from 2024 onwards (for example Chrome 123+, Firefox 121+, Safari 17.5+). Older browsers may show incorrect colours or layout. Automated browser checks were run in Chromium only.

## Known limitations

- **No accounts, cloud sync or backend.** Tasks live only in one browser on one device (see [Data storage](#data-storage-and-persistence)).
- **No export or import.** There is no built-in way to back up tasks to a file or move them to another browser.
- **No in-app restore of backups.** Backups of damaged data are kept in browser storage but can only be recovered manually (for example with the browser's developer tools).
- **Simultaneous edits in two tabs:** the most recent save wins. If two tabs change tasks at nearly the same moment, before either receives the other's update, the earlier change can be overwritten. Saving an edit form writes all of its fields, even if another tab changed that task while the form was open.
- After another tab clears the stored tasks, a tab that still has them open saves them again on its next change.
- Search, filter and sort settings reset when you leave the My Tasks page.
- Filters choose one value per field (for example one priority at a time).
- The "View in My Tasks" links on the dashboard open the full list, not a pre-filtered one.
- Due-date states such as "overdue" are recalculated when tasks change or the page reloads, not automatically at midnight.
- The interface is in English only, although dates are formatted for the browser's locale.
- No licence has been chosen for this repository yet.
