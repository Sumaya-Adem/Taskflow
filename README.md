# TaskFlow

TaskFlow is a clean, fast, responsive task management application for organising daily work and personal tasks. It runs entirely in the browser and persists data to `localStorage` — no backend, no account required.

> **Status:** early development. The project scaffold is in place; features are being built in phases (see [Roadmap](#roadmap)).

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
│   ├── main.jsx          # React entry point
│   ├── App.jsx           # Root component
│   ├── styles/           # Global styles and design tokens
│   └── test/             # Test setup and shared test utilities
├── eslint.config.js      # ESLint flat config
└── vite.config.js        # Vite + Vitest configuration
```

The structure will grow to include `config/`, `domain/`, `storage/`, `state/`, and `components/` directories as features are implemented.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Project scaffold and tooling | ✅ Done |
| 1 | Domain model, validation, and storage layer | Planned |
| 2 | State management, theming, and app shell | Planned |
| 3 | Task create / edit / delete / complete | Planned |
| 4 | Search, filtering, and sorting | Planned |
| 5 | Statistics dashboard | Planned |
| 6 | Responsive, accessibility, and robustness polish | Planned |
| 7 | Documentation and release | Planned |
