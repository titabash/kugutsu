#!/usr/bin/env python3
"""
Modern Python CLI tool using Typer.

This module provides a command-line interface for the hello-cli tool.
"""

import sys
from typing import Annotated, Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from hello_cli import __version__

# Create Typer app instance
app = typer.Typer(
    name="hello-cli",
    help="A modern Python CLI tool example 🚀",
    add_completion=True,
    rich_markup_mode="rich",
)

# Create Rich console for beautiful output
console = Console()


def version_callback(value: bool) -> None:
    """Display version information."""
    if value:
        console.print(f"hello-cli version: [bold blue]{__version__}[/bold blue]")
        raise typer.Exit()


@app.command()
def hello(
    name: Annotated[
        Optional[str],
        typer.Argument(help="Name to greet. If not provided, greets the world."),
    ] = None,
    count: Annotated[
        int,
        typer.Option(
            "--count",
            "-c",
            help="Number of greetings to display",
            min=1,
            max=100,
            rich_help_panel="Customization Options",
        ),
    ] = 1,
    uppercase: Annotated[
        bool,
        typer.Option(
            "--uppercase",
            "-u",
            help="Convert greeting to uppercase",
            rich_help_panel="Customization Options",
        ),
    ] = False,
    style: Annotated[
        str,
        typer.Option(
            "--style",
            "-s",
            help="Style of the greeting",
            rich_help_panel="Customization Options",
        ),
    ] = "simple",
) -> None:
    """
    Display a greeting message.

    This command shows a friendly greeting message with various customization options.
    """
    # Determine who to greet
    target = name or "World"

    # Create the greeting message
    message = f"Hello {target}!"

    if uppercase:
        message = message.upper()

    # Display greetings based on style
    if style == "fancy":
        for i in range(count):
            panel = Panel(
                Text(message, style="bold magenta"),
                title=f"Greeting #{i + 1}",
                border_style="bright_blue",
                padding=(1, 2),
            )
            console.print(panel)
    elif style == "table":
        table = Table(title="Greetings")
        table.add_column("Number", style="cyan", no_wrap=True)
        table.add_column("Message", style="magenta")

        for i in range(count):
            table.add_row(str(i + 1), message)

        console.print(table)
    else:
        # Simple style (default)
        for _ in range(count):
            console.print(f"[bold green]{message}[/bold green]")


@app.command()
def info() -> None:
    """Display information about this CLI tool."""
    info_table = Table(title="CLI Tool Information")
    info_table.add_column("Property", style="cyan", no_wrap=True)
    info_table.add_column("Value", style="magenta")

    info_table.add_row("Name", "hello-cli")
    info_table.add_row("Version", __version__)
    info_table.add_row("Description", "A modern Python CLI tool example")
    info_table.add_row("Framework", "Typer + Rich")
    info_table.add_row(
        "Python",
        f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
    )

    console.print(info_table)


@app.callback()
def main(
    version: Annotated[
        Optional[bool],
        typer.Option(
            "--version",
            "-v",
            callback=version_callback,
            is_eager=True,
            help="Show version and exit",
        ),
    ] = None,
) -> None:
    """
    A modern Python CLI tool example built with Typer and Rich.

    This tool demonstrates modern Python CLI development practices including:
    - Type hints and annotations
    - Rich text formatting and styling
    - Comprehensive help system
    - Input validation
    - Multiple output formats
    """
    pass


if __name__ == "__main__":
    app()
