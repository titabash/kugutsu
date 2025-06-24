#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
kugutsu - AI-powered parallel development system

Usage:
  kugutsu <prompt> [options]

Options:
  --max-engineers <num>    Maximum concurrent engineers (1-10, default: 3)
  --max-turns <num>        Maximum turns per task (5-50, default: 20)
  --base-branch <branch>   Base branch for development (default: main)
  --electron               Use Electron UI (default)
  --no-electron            Disable Electron UI
  --visual-ui              Use terminal split UI
  --cleanup                Clean up worktrees after completion
  --help, -h               Show this help message

Examples:
  kugutsu "Implement user authentication"
  kugutsu "Fix TypeScript errors" --max-engineers 2
  kugutsu "Add API endpoints" --no-electron --visual-ui

For more information, visit: https://github.com/titabash/kugutsu
`);
  process.exit(0);
}

require('../dist/parallel-dev.js');