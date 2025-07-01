![Kugutsu Logo](logos/kugutsu.png)

# Kugutsu 🎭

AI-powered parallel development system that orchestrates multiple AI engineers to work simultaneously on different tasks.

## Requirements

- Node.js 18+
- Git 2.7+
- Claude Code (authenticated via Anthropic Console or API Key)

## Quick Start

```bash
# 1. Set up Claude Code (if not already done)
# Follow: https://docs.anthropic.com/en/docs/claude-code/quickstart

# 2. Install kugutsu
npm install -g @titabash/kugutsu

# 3. Navigate to your project
cd your-project

# 4. Run kugutsu
kugutsu "Add user authentication"
```

## Installation

### GitHub Packages Setup

Since this package is distributed through GitHub Packages, you need to configure npm to use GitHub Packages registry:

```bash
# 1. Create a GitHub Personal Access Token with 'read:packages' scope
# Visit: https://github.com/settings/tokens/new?scopes=read:packages

# 2. Configure npm to use GitHub Packages for @titabash scope
npm config set @titabash:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken YOUR_GITHUB_TOKEN

# 3. Install the package
npm install -g @titabash/kugutsu
```

### Alternative: Using .npmrc file

You can also create a `.npmrc` file in your home directory:

```bash
echo "@titabash:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc
npm install -g @titabash/kugutsu
```

## Usage

```bash
# Basic usage
kugutsu "Your development request"

# Examples
kugutsu "Add error handling to all API endpoints"
kugutsu "Fix TypeScript errors" --max-engineers 2
kugutsu "Refactor user service" --cleanup
```

## Options

```bash
--max-engineers <num>     # Maximum concurrent engineers (default: 3)
--max-turns <num>        # Maximum turns per task (default: 20)
--cleanup               # Clean up worktrees after completion
--no-electron          # Disable Electron UI
--visual-ui            # Use terminal visual UI
```

## License

MIT
