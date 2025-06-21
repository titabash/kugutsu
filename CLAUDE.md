# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern Python CLI tool built with Typer and Rich, providing a command-line interface with beautiful terminal output. The project uses `uv` for dependency management and follows modern Python development practices.

## Development Commands

### Package Manager Policy
**IMPORTANT**: This project uses `uv` as the package manager. Direct use of `pip` is prohibited. All package operations must be performed through `uv`.

### Installation and Setup
```bash
# Install with uv (required - do not use pip directly)
uv sync

# Install with development dependencies
uv sync --group dev

# Install in editable mode (use uv pip, not pip directly)
uv pip install -e .
```

### Code Quality Commands
```bash
# Format code
ruff format

# Lint code
ruff check

# Type checking
mypy hello_cli

# Run all tests
pytest

# Run a specific test
pytest tests/test_main.py::test_hello_default

# Run tests with coverage
pytest --cov=hello_cli
```

### Pre-commit
```bash
# Install pre-commit hooks
pre-commit install
```

### Running the CLI
```bash
# Run hello-cli commands via uv
uv run hello-cli hello          # Display greeting message
uv run hello-cli info           # Display CLI tool information
uv run hello-cli --version      # Show version information
uv run hello-cli --help         # Show help message

# Run with custom name
uv run hello-cli hello --name "Alice"
```

## Architecture

### Project Structure
- `hello_cli/` - Main package directory
  - `__init__.py` - Package initialization with version info
  - `main.py` - Main CLI application using Typer
- `tests/` - Test suite using pytest
- `pyproject.toml` - Project configuration and dependencies

### Key Design Patterns
1. **CLI Framework**: Uses Typer for type-safe command definitions with automatic help generation
2. **Output Formatting**: Uses Rich for beautiful terminal output with panels, tables, and styled text
3. **Command Structure**: 
   - Main entry point through `app` Typer instance
   - Commands defined with `@app.command()` decorator
   - Version callback for `--version` flag
   - Global options in `@app.callback()`

### Testing Strategy
- Uses `typer.testing.CliRunner` for testing CLI commands
- Tests cover all command variations and options
- Minimum code coverage requirement: 80%