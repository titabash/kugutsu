"""Tests for the main CLI functionality."""

import pytest
from typer.testing import CliRunner

from hello_cli.main import app

runner = CliRunner()


def test_hello_default() -> None:
    """Test default hello command."""
    result = runner.invoke(app, ["hello"])
    assert result.exit_code == 0
    assert "Hello World!" in result.stdout


def test_hello_with_name() -> None:
    """Test hello command with custom name."""
    result = runner.invoke(app, ["hello", "Alice"])
    assert result.exit_code == 0
    assert "Hello Alice!" in result.stdout


def test_hello_with_count() -> None:
    """Test hello command with count option."""
    result = runner.invoke(app, ["hello", "--count", "3"])
    assert result.exit_code == 0
    # Should have 3 greetings
    assert result.stdout.count("Hello World!") == 3


def test_hello_uppercase() -> None:
    """Test hello command with uppercase option."""
    result = runner.invoke(app, ["hello", "alice", "--uppercase"])
    assert result.exit_code == 0
    assert "HELLO ALICE!" in result.stdout


def test_info_command() -> None:
    """Test info command."""
    result = runner.invoke(app, ["info"])
    assert result.exit_code == 0
    assert "hello-cli" in result.stdout


def test_version_option() -> None:
    """Test version option."""
    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert "hello-cli version" in result.stdout


def test_help() -> None:
    """Test help output."""
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "A modern Python CLI tool example" in result.stdout
