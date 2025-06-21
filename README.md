# Hello CLI 🚀

A modern Python CLI tool example built with Typer and Rich.

## Features

- ✨ Beautiful, rich terminal output
- 🎯 Type-safe command definitions
- 🔧 Auto-generated help and completion
- 📊 Multiple output formats (simple, fancy, table)
- 🐍 Modern Python practices (3.9+)

## Installation

### Using uv (recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd hello-cli

# Install with uv
uv sync

# Install in development mode
uv pip install -e .
```

### Using pip

```bash
pip install -e .
```

## Usage

### Basic greeting

```bash
hello-cli hello
# Output: Hello World!

hello-cli hello Alice
# Output: Hello Alice!
```

### Multiple greetings

```bash
hello-cli hello --count 3
hello-cli hello Alice -c 5
```

### Styling options

```bash
# Uppercase greeting
hello-cli hello --uppercase

# Fancy style with panels
hello-cli hello --style fancy

# Table format
hello-cli hello --style table --count 3
```

### Get information

```bash
hello-cli info
hello-cli --version
```

### Help

```bash
hello-cli --help
hello-cli hello --help
```

## Development

### Setup development environment

```bash
# Install with development dependencies
uv sync --group dev

# Install pre-commit hooks
pre-commit install
```

### Code quality

```bash
# Format code
ruff format

# Lint code
ruff check

# Type checking
mypy hello_cli

# Run tests
pytest
```

## Requirements

- Python 3.9+
- Dependencies managed with `uv`

## License

MIT License
