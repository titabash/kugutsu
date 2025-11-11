# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts the TypeScript orchestrator, node graph, provider adapters, and CLI entrypoints; keep modules cohesive by feature.
- `electron/` contains the renderer UI plus packaging config; run `npm install` there before touching Electron scripts.
- `spec/` stores living architecture and workflow docs; update the relevant markdown alongside any behavior changes.
- `tests/` (unit/integration), `tests/manual/` (scripted scenarios), and `test-e2e-realistic/` cover automation; reuse helpers in `tests/helpers` and `tests/__mocks__`.
- `docs/`, `examples/`, `logos/`, and `schema/` serve docs, samples, branding, and schemas; build output in `dist/` stays untouched.

## Build, Test, and Development Commands
- `npm run dev` or `npm run parallel-dev-cli` start the CLI with `tsx` hot reload.
- `npm run build` / `build:cli` type-check and emit output via `tsc`; run before publishing.
- `npm run electron:dev`, `electron:build`, and `electron:preview` cover local, prod, and demo Electron workflows; `npm run dist` or platform-specific `dist:*` add installers through `electron-builder`.
- `npm test`, `test:watch`, `test:coverage`, and targeted suites (`test:nodes`, `test:providers`, `test:integration`) exercise Jest with `NODE_OPTIONS=--experimental-vm-modules`.
- `npm run verify:e2e-minimal` and `verify:e2e-realistic` replay scripted end-to-end flows defined in `tests/manual/`.

## Coding Style & Naming Conventions
Target Node 20+ with strict TypeScript. Keep files formatted with 2-space indentation, `camelCase` symbols, `PascalCase` classes/components, and SCREAMING_SNAKE_CASE for constants only. Favor `async/await`, avoid introducing `any`, and add terse comments only when orchestration logic spans multiple agents.

## Testing Guidelines
Prefer fast Jest runs first, then the narrower suites covering the area you touched. Name unit files `<feature>.test.ts` and integration files `<area>.spec.ts` to align with `tests/`. Keep coverage from `npm run test:coverage` steady, refresh shared mocks when provider contracts change, and document notable manual scenarios in `tests/manual/README.md` after running the `verify:e2e-*` scripts.

## Commit & Pull Request Guidelines
Follow the Conventional Commit prefixes already in history (`feat:`, `refactor:`, `chore:`, etc.), keeping subjects under ~70 characters and adding multi-line bodies for context or breaking-change notes. Every PR should describe the problem, summarize the fix, list the commands executed, and link any relevant GitHub issues or spec files. Request reviews from both CLI and Electron owners when cross-cutting contracts move.

## Security & Configuration Tips
Do not commit secrets; load Claude/OpenAI keys through your shell environment or an ignored `.env`. Validate anything under `schema/` and rerun `npm run build` before publishing so generated `dist/` artifacts stay in sync. Electron installers rely on external signing assets—coordinate with the release owner before running `npm run dist:*`.
