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


def test_hello_with_long_name() -> None:
    """Test hello command with a very long name (50+ characters)."""
    long_name = "Alexander Bartholomew Christopher Davidson Emmanuel Fitzgerald"
    assert len(long_name) > 50
    result = runner.invoke(app, ["hello", long_name])
    assert result.exit_code == 0
    assert f"Hello {long_name}!" in result.stdout


def test_hello_with_special_characters() -> None:
    """Test hello command with special characters in name."""
    special_names = [
        "Alice@Bob",
        "名前",  # Japanese characters
        "José García",  # Spanish accented characters
        "Müller",  # German umlaut
        "O'Brien",  # Apostrophe
        "Jean-Pierre",  # Hyphen
        "Alice & Bob",  # Ampersand
        "123User",  # Numbers
        "user@example.com",  # Email-like
    ]
    
    for name in special_names:
        result = runner.invoke(app, ["hello", name])
        assert result.exit_code == 0
        assert f"Hello {name}!" in result.stdout


def test_info_command_content_accuracy() -> None:
    """Test that info command displays accurate information."""
    result = runner.invoke(app, ["info"])
    assert result.exit_code == 0
    
    # Check that all expected fields are present
    assert "Name" in result.stdout
    assert "hello-cli" in result.stdout
    
    assert "Version" in result.stdout
    # Version format should be x.y.z
    import re
    assert re.search(r"\d+\.\d+\.\d+", result.stdout) is not None
    
    assert "Description" in result.stdout
    assert "A modern Python CLI tool example" in result.stdout
    
    assert "Framework" in result.stdout
    assert "Typer + Rich" in result.stdout
    
    assert "Python" in result.stdout
    # Python version format should be x.y.z
    assert re.search(r"Python.*\d+\.\d+\.\d+", result.stdout) is not None
    
    # Check table structure
    assert "CLI Tool Information" in result.stdout
    assert "Property" in result.stdout
    assert "Value" in result.stdout
