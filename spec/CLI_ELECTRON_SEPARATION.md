# CLI/Electron Separation Specification

**Version:** 1.0
**Date:** 2025-01-06
**Status:** Implemented

## Overview

This specification describes the complete separation of CLI and Electron execution modes in Kugutsu, transforming the Electron component into a standalone desktop application similar to VSCode or Cursor.

## Goals

1. **Complete Independence**: CLI and Electron modes operate independently without interference
2. **Standalone Application**: Electron app functions as a self-contained desktop application
3. **Distribution Ready**: Enable packaging and distribution of the Electron app
4. **User Experience**: Provide VSCode/Cursor-like project management workflow

## Architecture Changes

### Before (v0.0.27 and earlier)

```
parallel-dev.ts (single entry point)
├─ --electron flag → ParallelDevelopmentOrchestratorWithElectron
│  └─ Launches Electron as child process
│  └─ IPC communication with parent process
└─ --no-electron flag → ParallelDevelopmentOrchestrator
   └─ Terminal-only execution
```

**Problems:**
- CLI execution could accidentally launch Electron
- Electron was tightly coupled to CLI execution
- Cannot distribute Electron as standalone app
- Confusing user experience

### After (v0.0.28+)

```
parallel-dev-cli.ts (CLI entry point)
└─ ParallelDevelopmentOrchestrator
   └─ Terminal-only execution
   └─ No Electron dependencies

Electron App (independent application)
├─ Launch standalone
├─ File > Open Project
├─ Select Git repository
└─ Run development tasks in project context
```

**Benefits:**
- Clear separation of concerns
- Electron app can be distributed independently
- VSCode/Cursor-like user experience
- No accidental Electron launches

## Implementation Details

### 1. CLI Mode (`parallel-dev-cli.ts`)

**Entry Point:** `src/parallel-dev-cli.ts`

**Command:**
```bash
npm run parallel-dev-cli "<request>" [options]
# or after npm install -g
kugutsu "<request>" [options]
```

**Key Features:**
- No Electron dependencies
- Uses `ParallelDevelopmentOrchestrator` only
- Optional terminal split UI (`ImprovedParallelLogViewer`)
- All git operations in current working directory

**Options:**
```
--base-repo <path>        Base repository path (default: .)
--worktree-base <path>    Worktree base path (default: ./worktrees)
--max-engineers <num>     Max concurrent engineers (default: 10, range: 1-100)
--max-turns <num>         Max turns per task (default: 50, range: 5-50)
--base-branch <branch>    Base branch (default: current branch)
--keep-worktrees          Keep worktrees after completion
--visual-ui               Use terminal split-pane UI
--help, -h                Show help
--version, -v             Show version
```

### 2. Electron Desktop App

**Entry Point:** `electron/main/index.ts`

**Launch:**
```bash
npm run electron
# or from distributed app
open Kugutsu.app  # macOS
Kugutsu.exe       # Windows
./Kugutsu.AppImage # Linux
```

**Key Features:**

#### Application Menu
- **File Menu**:
  - Open Project... (⌘O/Ctrl+O)
  - Close Project (⌘W/Ctrl+W)
  - Quit (⌘Q/Ctrl+Q)
- **Edit Menu**: Undo, Redo, Cut, Copy, Paste, Select All
- **View Menu**: Reload, Toggle DevTools, Zoom controls, Full screen
- **Help Menu**: Learn More (opens GitHub)

#### Project Management Flow
1. **Launch App**: Shows welcome screen
2. **Open Project**:
   - File > Open Project or click button
   - Select directory via native dialog
   - Validates Git repository (rejects worktrees/submodules)
3. **Project Active**:
   - Shows toolbar with project path
   - Displays main UI (kanban, graph, logs)
   - All operations apply to selected project
4. **Close Project**: Returns to welcome screen

#### UI Components

**Toolbar** (`Toolbar.tsx`):
- Current project path display
- Project name extraction
- "Open Project" / "Change Project" button

**Welcome Screen** (`WelcomeScreen.tsx`):
- Branding and logo
- Feature highlights
- "Open Project" call-to-action
- System information

**Main UI** (conditional rendering in `App.tsx`):
- Header with metadata
- Task Kanban Board
- Dependency Graph Visualization
- Log Viewer (bottom panel)

#### State Management

**AppStore** (`appStore.ts`):
```typescript
interface AppState {
  // Existing state...
  projectPath: string | null  // NEW: Current project path

  // Actions
  setProjectPath: (path: string | null) => void  // NEW
}
```

**IPC Communication** (`preload/index.ts`):
```typescript
// Main → Renderer
- 'project-opened': { projectPath: string }
- 'project-closed': void

// Renderer → Main
- getCurrentProjectPath(): Promise<string | null>
- openProjectDialog(): Promise<string | null>
```

### 3. Application Distribution

**Configuration:** `electron-builder.yml`

**Supported Platforms:**
- macOS: .dmg (x64, arm64)
- Windows: .exe (x64, NSIS installer)
- Linux: .AppImage, .deb (x64)

**Build Commands:**
```bash
# Install builder
npm install --save-dev electron-builder

# Build all
npm run build:all        # TypeScript + Renderer
npm run dist             # Current platform

# Platform-specific
npm run dist:mac         # macOS only
npm run dist:win         # Windows only
npm run dist:linux       # Linux only

# Test without installer
npm run pack             # Directory build only
```

**Output:** `dist-electron/` directory

**Assets Required:**
- `build/icon.icns` (macOS)
- `build/icon.ico` (Windows)
- `build/icon.png` (Linux, 1024x1024)

## File Structure Changes

### New Files
```
src/
└── parallel-dev-cli.ts              # NEW: CLI entry point

electron/
├── main/index.ts                    # UPDATED: Menu & project management
├── preload/index.ts                 # UPDATED: IPC channels
└── renderer/
    ├── components/
    │   ├── Toolbar.tsx              # NEW
    │   └── WelcomeScreen.tsx        # NEW
    ├── App.tsx                      # UPDATED: Conditional rendering
    └── store/
        └── appStore.ts              # UPDATED: projectPath state

electron-builder.yml                 # NEW: Build configuration
spec/
└── CLI_ELECTRON_SEPARATION.md      # NEW: This document
```

### Modified Files
```
package.json                         # Scripts updated
electron/package.json               # @types/electron removed
src/types/index.ts                  # estimatedTime? added
src/parallel-dev.ts                 # estimatedTime handling
CLAUDE.md                           # Documentation updated
README.md                           # Usage instructions updated
```

### Deprecated Files
```
src/parallel-dev.ts                 # Still exists but less relevant
                                   # May be removed in future
```

## Package.json Scripts

### Root package.json
```json
{
  "scripts": {
    "build": "tsc && npm run build:electron",
    "build:electron": "cd electron && tsc",
    "build:renderer": "cd electron && npm run build:renderer",
    "build:all": "npm run build && npm run build:renderer",

    "kugutsu": "node dist/parallel-dev-cli.js",
    "parallel-dev-cli": "tsx src/parallel-dev-cli.ts",

    "electron": "cd electron && electron .",
    "electron:build": "npm run build:electron && npm run electron",
    "electron:dev": "npm run build:all && npm run electron",

    "pack": "npm run build:all && electron-builder --dir",
    "dist": "npm run build:all && electron-builder",
    "dist:mac": "npm run build:all && electron-builder --mac",
    "dist:win": "npm run build:all && electron-builder --win",
    "dist:linux": "npm run build:all && electron-builder --linux"
  },
  "bin": {
    "kugutsu": "./dist/parallel-dev-cli.js"
  }
}
```

## Migration Guide

### For CLI Users

**No changes required.** The CLI command remains the same:

```bash
# Old (still works)
kugutsu "your request"

# New (preferred)
npm run parallel-dev-cli "your request"
```

### For Electron Users

**Breaking Change:** Electron is now a standalone app.

**Old Workflow:**
```bash
# Started automatically with development request
npm run parallel-dev "request" --electron
```

**New Workflow:**
```bash
# 1. Start Electron app
npm run electron

# 2. File > Open Project
# 3. Select Git repository
# 4. Use UI to run development
```

**Migration Steps:**
1. Build the new version: `npm run build:all`
2. Launch Electron: `npm run electron`
3. Open your project via File menu
4. Existing `.kugutsu/` data will be detected automatically

## Testing Checklist

### CLI Mode
- [ ] `npm run parallel-dev-cli --help` shows help
- [ ] `npm run parallel-dev-cli "test" --max-engineers 1` executes without Electron
- [ ] `--visual-ui` flag shows terminal split UI
- [ ] `--keep-worktrees` preserves git worktrees
- [ ] Git operations work in current directory
- [ ] No Electron process spawned

### Electron App
- [ ] `npm run electron` launches app
- [ ] Welcome screen displays correctly
- [ ] File > Open Project opens dialog
- [ ] Can select valid Git repository
- [ ] Invalid directories are rejected with error message
- [ ] Worktrees/submodules are rejected
- [ ] Toolbar shows project path
- [ ] Main UI displays after project opened
- [ ] File > Close Project returns to welcome screen
- [ ] Menu keyboard shortcuts work (⌘O, ⌘W, ⌘Q)

### Distribution
- [ ] `npm run pack` creates app in `dist-electron/`
- [ ] `npm run dist` creates installer for current platform
- [ ] Installed app launches correctly
- [ ] All functionality works in distributed app
- [ ] macOS: App opens despite unsigned warning
- [ ] Windows: Installer executes correctly
- [ ] Linux: AppImage is executable

### Build Process
- [ ] `npm run build` completes without errors
- [ ] `npm run build:electron` compiles TypeScript
- [ ] `npm run build:renderer` builds React UI
- [ ] `npm run build:all` builds everything
- [ ] No TypeScript errors
- [ ] No broken imports

## Known Issues

### 1. Type Definition Conflicts

**Issue:** Old `@types/electron` package conflicts with Electron's built-in types.

**Resolution:**
```bash
cd electron && npm uninstall @types/electron
```

Electron v37.1.0+ includes its own TypeScript definitions.

### 2. Dialog Return Value Type

**Issue:** `dialog.showOpenDialog` return type varies between Electron versions.

**Resolution:** Use type guards:
```typescript
const result = await dialog.showOpenDialog(mainWindow, options);
if (typeof result !== 'object' || !('canceled' in result)) {
  return;
}
// Now result is correctly typed
```

### 3. estimatedTime Property

**Issue:** `TaskAnalysisResult` interface missing `estimatedTime`.

**Resolution:** Added optional property:
```typescript
interface TaskAnalysisResult {
  estimatedTime?: string;
  // ...
}
```

## Future Enhancements

### Short-term (v0.0.29)
- [ ] Add application icon assets
- [ ] Implement code signing for macOS
- [ ] Add Windows certificate signing
- [ ] Auto-update functionality

### Mid-term (v0.1.0)
- [ ] Project history/recent projects
- [ ] Multiple project tabs
- [ ] Integrated terminal in Electron
- [ ] Settings/preferences UI

### Long-term (v1.0.0)
- [ ] Plugin system
- [ ] Custom themes
- [ ] Cloud sync for project settings
- [ ] Multi-language support

## References

- Electron Documentation: https://www.electronjs.org/docs/latest
- electron-builder: https://www.electron.build/
- VSCode Architecture: https://code.visualstudio.com/api
- Cursor Documentation: https://cursor.sh/

## Version History

- **v1.0 (2025-01-06)**: Initial specification - CLI/Electron separation implemented
