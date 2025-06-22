"""Tests for the main CLI functionality."""

import pytest
from typer.testing import CliRunner
from unittest.mock import patch, AsyncMock

from hello_cli.main import app

runner = CliRunner()


def test_hello_default() -> None:
    """Test default hello command."""
    result = runner.invoke(app, ["hello"])
    assert result.exit_code == 0
    assert "Hey World!" in result.stdout


def test_hello_with_name() -> None:
    """Test hello command with custom name."""
    result = runner.invoke(app, ["hello", "Alice"])
    assert result.exit_code == 0
    assert "Hey Alice!" in result.stdout


def test_hello_with_count() -> None:
    """Test hello command with count option."""
    result = runner.invoke(app, ["hello", "--count", "3"])
    assert result.exit_code == 0
    # Should have 3 greetings
    assert result.stdout.count("Hey World!") == 3


def test_hello_uppercase() -> None:
    """Test hello command with uppercase option."""
    result = runner.invoke(app, ["hello", "alice", "--uppercase"])
    assert result.exit_code == 0
    assert "HEY ALICE!" in result.stdout


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
    assert "A modern Python CLI tool with Claude Code SDK integration" in result.stdout


def test_hello_with_long_name() -> None:
    """Test hello command with a very long name (50+ characters)."""
    long_name = "Alexander Bartholomew Christopher Davidson Emmanuel Fitzgerald"
    assert len(long_name) > 50
    result = runner.invoke(app, ["hello", long_name])
    assert result.exit_code == 0
    assert f"Hey {long_name}!" in result.stdout


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
        assert f"Hey {name}!" in result.stdout


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
    assert "A modern Python CLI tool with Claude Code SDK integration" in result.stdout
    
    assert "Framework" in result.stdout
    assert "Typer + Rich" in result.stdout
    
    assert "Python" in result.stdout
    # Python version format should be x.y.z
    assert re.search(r"Python.*\d+\.\d+\.\d+", result.stdout) is not None
    
    # Check table structure
    assert "CLI Tool Information" in result.stdout
    assert "Property" in result.stdout
    assert "Value" in result.stdout


def test_claude_command_no_sdk() -> None:
    """Test claude command without SDK installed."""
    with patch('hello_cli.main.CLAUDE_SDK_AVAILABLE', False):
        result = runner.invoke(app, ["claude", "test prompt"])
        assert result.exit_code == 1
        assert "claude-code-sdk が利用できません" in result.stdout


def test_claude_command_help() -> None:
    """Test claude command help."""
    result = runner.invoke(app, ["claude", "--help"])
    assert result.exit_code == 0
    assert "Claude Code SDKを使用してプロンプトを実行" in result.stdout


@patch('hello_cli.main.CLAUDE_SDK_AVAILABLE', True)
@patch('hello_cli.main.query')
@patch('hello_cli.main.anyio.run')
def test_claude_command_with_sdk(mock_anyio_run, mock_query, mock_sdk_available) -> None:
    """Test claude command with SDK available."""
    # Mock the async generator
    async def mock_async_generator():
        yield "Response from Claude"
    
    mock_query.return_value = mock_async_generator()
    
    result = runner.invoke(app, ["claude", "test prompt"])
    
    # コマンドが正常に実行される（anyio.runが呼ばれる）
    assert mock_anyio_run.called


@patch('hello_cli.main.CLAUDE_SDK_AVAILABLE', True)
def test_claude_command_with_options() -> None:
    """Test claude command with various options."""
    with patch('hello_cli.main.anyio.run') as mock_run:
        result = runner.invoke(app, [
            "claude", 
            "test prompt",
            "--working-dir", "/test/dir",
            "--max-turns", "10",
            "--system", "test system prompt"
        ])
        
        # コマンドが正常に解析される
        assert mock_run.called
