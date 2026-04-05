# Gitignore Design

## Goal

Add a root `.gitignore` for this Electron + TypeScript app that ignores generated and machine-local files while keeping source, docs, scripts, and lockfiles tracked.

## Project Context

This project currently contains:
- `node_modules/` dependency installs
- `dist/` generated TypeScript output
- `package-lock.json` lockfile
- source in `src/`
- docs in `docs/`
- build scripts in `scripts/`

There is not currently a root `.gitignore`.

## Approved Scope

Use a standard application repository `.gitignore`:
- ignore dependencies: `node_modules/`
- ignore build output: `dist/`
- ignore logs and debug artifacts: `*.log`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`
- ignore environment files: `.env`, `.env.*`
- ignore common macOS/editor noise: `.DS_Store`, `.vscode/`, `.idea/`
- keep `package-lock.json` tracked
- keep `src/`, `docs/`, `scripts/`, and project config files tracked

## Non-Goals

- Do not ignore `package-lock.json`
- Do not add broad patterns that could hide real project files
- Do not add repo-policy files like `.gitattributes` or GitHub Actions in this change

## GitHub Repo Settings To Keep

- Keep the root `.gitignore` tracked in the repository
- Keep `package-lock.json` committed
- Keep default-branch protection if you use protected branches
- Keep PR requirement enabled if you want review gates
- Keep required status checks enabled only if CI is configured
- Keep secret scanning and Dependabot alerts enabled if available
- Keep Git LFS disabled unless you intentionally add large binary assets later

## Verification

1. Confirm the new `.gitignore` is created at the repo root.
2. Confirm ignored directories include `node_modules/` and `dist/`.
3. Confirm `package-lock.json` remains trackable.
4. Confirm source and docs paths are not ignored.
