# Changelog

All notable changes to TaskFlow are recorded here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [semantic versioning](https://semver.org/).

## [1.0.0] — 2026-10-09

First release. TaskFlow is a browser-only task manager built with React 19 and Vite 8. Tasks are stored in the browser's `localStorage`; there is no backend, account system or cloud sync.

### Added

**Tasks**
- Create, edit, complete, reopen and delete tasks with a title, optional description, priority, category and optional due date.
- Validation for every field (title required and up to 120 characters, description up to 1,000 characters, known priority and category, real calendar dates), shown next to each field.
- Delete confirmation dialog that focuses Cancel first and can only be confirmed once.
- Overdue, due-today, due-soon and completed states, written out in text as well as colour.

**Search, filters and sorting**
- Search across titles and descriptions, ignoring capitals and accents.
- Filters for status, priority, category and due date (overdue, due today, due soon, no due date), combinable.
- Sorting by date created, due date (undated last), priority, title, status or last updated, in either direction, with a stable order for equal values.
- Removable chips for active settings, "Reset all", and a separate "No matching tasks" state.

**Dashboard**
- Total, active, completed and overdue counts.
- Completion percentage with an accessible progress bar.
- Tasks by priority, including priorities with no tasks.
- Overdue and upcoming task lists, most urgent first; tasks open for editing from the dashboard.

**Persistence and reliability**
- Versioned storage format with validation and repair of damaged records on every load.
- Backups of damaged or unreadable data before anything is replaced.
- Data from a newer app version is never overwritten.
- Each change is saved immediately; changes that could not be saved are reported with a warning instead of a success message.
- Changes in one tab appear in other open tabs; clearing or corrupting storage in another tab does not wipe the tasks open in this one.

**Interface and accessibility**
- Dashboard, My Tasks and Settings pages with hash-based navigation, deep links and back-button support.
- Light, dark and system themes, applied before the first paint and synced across tabs.
- Responsive layout from 320 px phones to wide desktops.
- Semantic landmarks and headings, a skip link, accessible names for all controls, keyboard-friendly native dialogs, AA text contrast, 3:1 form-control borders, and reduced-motion support.

**Development**
- 584 automated tests (Vitest, React Testing Library, jsdom) across 24 test files, all passing at release.
- ESLint flat configuration with React Hooks and React Refresh rules.

### Known limitations

- Data lives in one browser on one device; there are no accounts, no cloud sync, and no export or import.
- Backups of damaged data can only be recovered manually.
- When two tabs save at almost the same moment, the most recent save wins and an earlier change can be overwritten.
- Search, filter and sort settings reset when leaving the My Tasks page; filters select one value per field.
- Due-date states update when tasks change or the page reloads, not automatically at midnight.
- Requires a modern browser (2024 or newer). Automated browser checks were run in Chromium only; no screen-reader or physical-device testing yet.

[1.0.0]: https://github.com/Sumaya-Adem/Taskflow
