# Claude Avatars

Animated pixel-art companions that float above the macOS Dock, one for each active Claude Code session.

Claude Avatars gives you an ambient view of what your sessions are doing without constantly switching between terminals. Each avatar reflects session state, shows the project name, surfaces the current task on hover, and can bring the matching terminal window to the front on click.

## Features

- Live Claude session detection from local session metadata
- State-aware pixel avatars for `coding`, `thinking`, `idle`, and `error`
- Project labels rendered directly with each avatar
- Hover tooltip with the current task for each active session
- Click-to-focus behavior for the matching Terminal or iTerm window
- Dock-aware overlay that adapts to bottom, left, and right Dock positions
- Menu bar tray icon with session count and launch-at-login toggle
- Mock-data mode for development when no local Claude session files are present

## Installation

### Download the latest build

- [Download the latest macOS DMG (Apple Silicon)](https://github.com/kumarvnsh/Claude-Avatar/releases/latest/download/Claude-Avatars-latest-arm64.dmg)
- [Browse all releases](https://github.com/kumarvnsh/Claude-Avatar/releases)

### Install from a DMG

If you have a packaged Claude Avatars DMG:

1. Open the `.dmg` file.
2. Drag `Claude Avatars.app` into `Applications`.
3. Launch the app from `Applications`.
4. If macOS prompts for permissions related to automation or accessibility, allow them so window focusing works reliably.

### Run locally from source

Requirements:

- macOS
- Node.js and npm
- Claude Code session data available under `~/.claude` for real session tracking

Install dependencies and run the app:

```bash
npm install
npm run dev
```

## Build

### Build the app locally

```bash
bash scripts/build.sh
```

### Build a macOS DMG

```bash
bash scripts/build.sh
npm run package -- --publish never
```

The packaged macOS artifacts are written to the `release/` directory. On Apple Silicon, the generated DMG is named like `release/Claude Avatars-1.0.0-arm64.dmg`.
The stable release filename used for direct downloads is `release/Claude-Avatars-latest-arm64.dmg`.

## Permissions And Notes

- Claude Avatars is currently macOS-only.
- Click-to-focus behavior depends on AppleScript-based app activation and may require macOS permission prompts to be approved.
- Real session monitoring depends on Claude session and todo metadata being available in your home directory.
- If the app does not find a Claude sessions directory, it falls back to mock data for development and visual testing.

## Developer Notes

Useful commands:

```bash
npm run dev      # build and launch the app
npm run build    # TypeScript compile
npm run watch    # watch TypeScript changes
npm run package  # build a macOS package with electron-builder
npm run clean    # remove dist output
```

Project structure:

```text
src/main      Electron main process, tray, session monitor, Dock detection
src/preload   Safe IPC bridge exposed to the renderer
src/renderer  Canvas avatar rendering, overlay page, tooltip logic
src/shared    Shared types between processes
scripts/      Local build helpers
release/      Packaged build output
```

## License

[MIT](./LICENSE)
