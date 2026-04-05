# Claude Avatars - Design Spec

## Overview

A macOS Electron app that displays animated pixel-art creatures floating above the Dock — one per active Claude Code session. Each avatar reflects the session's current state (thinking, coding, idle, error) through animations and expressions. Hovering shows the project name and current task. Clicking an avatar brings that Claude Code window to the front.

## Problem

When running multiple Claude Code sessions simultaneously, there's no at-a-glance way to see what each session is doing without switching between terminal windows. Claude Avatars provides ambient, always-visible status for all sessions.

## User Experience

### Visual Behavior
- Small (~40x40px) pixel-art creatures float in a row just above the macOS Dock
- Each creature has a unique color (deterministic from session ID)
- Below each creature, a small label shows the project directory basename (e.g., "my-app")
- Creatures animate based on state:
  - **Thinking**: thought bubbles, eyes looking up, slow bob
  - **Coding**: sparkle particles, happy expression, typing motion
  - **Idle**: sleepy eyes, slow breathing, occasional blink
  - **Error**: X eyes, red tint, exclamation mark
  - **Spawning**: fade-in with bounce animation when a new session appears
  - **Despawning**: fade-out when a session ends

### Hover Tooltip
- On hover, a styled tooltip appears above the avatar showing:
  - Project directory name (bold, colored to match avatar)
  - Current in-progress task text (from todo activeForm)
- Tooltip has a dark semi-transparent background with rounded corners

### Click to Focus
- Clicking an avatar brings the associated Claude Code terminal window to the front
- Uses AppleScript to activate the window by matching the terminal process

### Dock Position Awareness
- Detects macOS Dock position (bottom, left, right) and screen dimensions
- Positions the avatar overlay adjacent to the Dock on the correct edge
- Watches for Dock position/display changes and repositions automatically

## Architecture

### Tech Stack
- **Runtime**: Electron 33+
- **Language**: TypeScript
- **Renderer**: HTML5 Canvas for pixel art sprites
- **Build**: electron-builder for DMG packaging
- **Distribution**: DMG download + Homebrew Cask formula

### Component Overview

```
┌─────────────────────────────────────────┐
│  Electron Main Process                   │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ SessionMonitor│  │ DockDetector    │  │
│  │ (polls files) │  │ (screen/dock)   │  │
│  └──────┬───────┘  └───────┬─────────┘  │
│         │ IPC               │ IPC        │
│  ┌──────┴───────────────────┴─────────┐  │
│  │       Overlay BrowserWindow         │  │
│  │  (transparent, always-on-top)       │  │
│  │                                     │  │
│  │  ┌────────────────────────────┐     │  │
│  │  │ AvatarRenderer (Canvas)    │     │  │
│  │  │ - Sprite animations        │     │  │
│  │  │ - Hover tooltips           │     │  │
│  │  │ - Click handlers           │     │  │
│  │  └────────────────────────────┘     │  │
│  └─────────────────────────────────────┘  │
│                                          │
│  ┌──────────────┐                        │
│  │ Tray Menu    │ (settings, quit)       │
│  └──────────────┘                        │
└─────────────────────────────────────────┘
```

### SessionMonitor

Runs in the main process. Responsible for discovering and tracking Claude Code sessions.

**Discovery (every 3 seconds):**
1. Read all files in `~/.claude/sessions/*.json`
2. Parse each: `{ pid, sessionId, cwd, startedAt, kind, entrypoint }`
3. Validate PID is alive via `process.kill(pid, 0)` (signal 0 = existence check)
4. Remove stale sessions where PID is dead

**Status Enrichment (per active session):**
1. Read todo files: glob `~/.claude/todos/<sessionId>-agent-*.json`, pick most recent by mtime
   - Extract `activeForm` field for current task display
   - If no todo file exists, state = "idle"
2. Read bridge file: glob `/var/folders/*/T/claude-ctx-<sessionId>.json`
   - Extract `remaining_percentage` for context usage (available for future features)
3. Determine state:
   - Has active todo with `activeForm` → "coding" (or "thinking" if activeForm contains "thinking"/"planning"/"researching")
   - No active todo, session alive → "idle"
   - PID alive but last bridge timestamp > 5 min ago → "idle"
   - Session file exists but PID dead → remove
   - Note: "error" state is not currently detectable from session files. For v1, we omit error state detection. The error sprite exists in the sprite sheet for future use (e.g., if Claude Code exposes error status in session metadata).

**IPC Output:** Sends `sessions-updated` event to renderer with array of:
```typescript
interface SessionInfo {
  sessionId: string;
  pid: number;
  cwd: string;
  projectName: string;  // basename of cwd
  startedAt: number;
  state: 'thinking' | 'coding' | 'idle' | 'error';
  currentTask: string | null;  // activeForm text
  color: string;  // deterministic from sessionId
}
```

### DockDetector

Detects the macOS Dock position and dimensions to position the overlay.

**Implementation:**
- Run `defaults read com.apple.dock orientation` to get dock position (bottom/left/right)
- Run `defaults read com.apple.dock autohide` to check auto-hide state
- Use Electron's `screen.getPrimaryDisplay().workAreaSize` and `bounds` to calculate Dock dimensions
- Listen for `screen` display change events to reposition

**Positioning Logic:**
- Dock at bottom: overlay window positioned at `(workArea.x, workArea.y + workArea.height)` with full width, ~80px height
- Dock at left: overlay positioned at `(0, workArea.y)` with ~80px width, full height
- Dock at right: similar, on the right edge
- If Dock is auto-hidden: position at the screen edge where Dock appears

### Overlay BrowserWindow

**Window Configuration:**
```typescript
new BrowserWindow({
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  hasShadow: false,
  resizable: false,
  focusable: false,
  type: 'panel',  // macOS: doesn't steal focus
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
  }
});

// Click-through with mouse event forwarding
win.setIgnoresMouseEvents(true, { forward: true });
// Level above Dock but below alerts
win.setAlwaysOnTop(true, 'pop-up-menu');
```

**Mouse Handling:**
- The window is click-through by default
- When the renderer detects cursor is over an avatar hitbox, it sends IPC to main to toggle `setIgnoresMouseEvents(false)` temporarily
- On mouseleave from avatar area, re-enable click-through

### AvatarRenderer

Canvas-based pixel art renderer in the browser window.

**Sprite System:**
- Pre-defined 16x16 pixel sprite frames stored as typed arrays
- Each state has 2-4 animation frames at 4 FPS (slow, ambient feel)
- Colors applied at render time by replacing palette indices
- Sprites rendered at 3x scale (48x48 display pixels)

**Color Assignment:**
- Hash sessionId → HSL hue (0-360), fixed saturation 65%, lightness 55%
- Deterministic: same session always gets same color
- At least 30 degrees hue separation between concurrent sessions

**Layout:**
- Avatars centered horizontally in the overlay window
- 60px spacing between avatar centers
- Project label rendered below each sprite in 9px monospace

**Animation Loop:**
- `requestAnimationFrame` loop
- Update sprite frame every 250ms
- State-specific particle effects drawn on top of sprite
- Smooth position transitions when avatars are added/removed (300ms ease)

### Click-to-Focus

**Window Resolution:**
1. From SessionInfo, get the PID of the Claude Code process
2. Get parent PID (the terminal that launched Claude): `ps -o ppid= -p <pid>`
3. Get the terminal application name: `ps -o comm= -p <ppid>`
4. Use AppleScript to activate that window:

```applescript
tell application "System Events"
  set targetProcess to first process whose unix id is <ppid>
  set frontmost of targetProcess to true
end tell
```

Fallback: If the above fails (e.g., Claude Desktop app), try matching by `entrypoint` field:
- `entrypoint: "claude-desktop"` → activate "Claude" app
- `entrypoint: "cli"` → activate parent terminal process

### Tray Menu

System tray icon (menu bar) providing:
- **Status**: "Watching N sessions"
- **Separator**
- **Launch at Login**: toggle checkbox (uses `app.setLoginItemSettings`)
- **Separator**
- **Quit Claude Avatars**

No complex settings UI in v1 — keep it simple.

## Data Flow

```
~/.claude/sessions/*.json ──────┐
                                │
~/.claude/todos/<sid>-*.json ───┤  SessionMonitor
                                │  (main process)
/var/folders/*/T/claude-ctx-*.json──┘       │
                                     IPC sessions-updated
                                            │
                                     AvatarRenderer
                                     (renderer/canvas)
                                            │
                               ┌────────────┼────────────┐
                               │            │            │
                          draw sprites  show tooltip  click→focus
```

## Project Structure

```
claude-avatars/
├── package.json
├── tsconfig.json
├── electron-builder.yml
├── src/
│   ├── main/
│   │   ├── index.ts              # App entry, window creation
│   │   ├── session-monitor.ts    # File polling, session discovery
│   │   ├── dock-detector.ts      # Dock position detection
│   │   ├── window-focus.ts       # AppleScript window activation
│   │   └── tray.ts               # Menu bar tray icon
│   ├── preload/
│   │   └── index.ts              # Context bridge for IPC
│   ├── renderer/
│   │   ├── index.html            # Transparent overlay page
│   │   ├── index.ts              # Entry, IPC listener
│   │   ├── avatar-renderer.ts    # Canvas sprite rendering
│   │   ├── sprites.ts            # Pixel art sprite data
│   │   ├── tooltip.ts            # Hover tooltip logic
│   │   └── styles.css            # Tooltip and label styles
│   └── shared/
│       └── types.ts              # SessionInfo interface, shared types
├── assets/
│   └── tray-icon.png             # 22x22 menu bar icon
├── scripts/
│   └── build.sh                  # Build & package script
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-04-05-claude-avatars-design.md
```

## Installation & Distribution

### From DMG (direct download)
1. Download `Claude-Avatars.dmg`
2. Drag to Applications
3. Launch — avatars appear above Dock
4. Grant Accessibility permission when prompted (needed for window focusing via AppleScript)

### From Homebrew
```bash
brew install --cask claude-avatars
```

### Permissions Required
- **Accessibility**: For AppleScript window activation (click-to-focus feature)
- No other special permissions needed — file reads are in user home directory

## Verification Plan

1. **Session Discovery**: Launch 2-3 Claude Code sessions in different directories. Verify avatars appear within 3 seconds, each with correct project name and unique color.
2. **State Tracking**: Start a task in one session. Verify avatar transitions from idle to coding/thinking. Complete the task, verify return to idle.
3. **Hover Tooltip**: Hover over each avatar. Verify tooltip shows correct project name and current task.
4. **Click to Focus**: Click each avatar. Verify the corresponding terminal window comes to front.
5. **Session Lifecycle**: Close a Claude Code session. Verify its avatar despawns with fade-out. Open a new one, verify spawn animation.
6. **Dock Position**: Move Dock to left/right/bottom. Verify avatars reposition correctly.
7. **DMG Install**: Build DMG, install on a clean Mac, verify app launches and auto-detects sessions.
8. **Login Item**: Enable "Launch at Login", restart Mac, verify app starts automatically.
