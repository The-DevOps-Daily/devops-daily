"""
CLI entry point for the 101 Linux Commands application.
"""

import typer

from commands import hello
from __version__ import get_version_string

app = typer.Typer(help="101 Linux Commands CLI 🚀")


def _version_callback(value: bool):
    if value:
        typer.echo(get_version_string())
        raise typer.Exit()


@app.callback()
def main(
    version: bool = typer.Option(
        False,
        "--version",
        help="Show the application version and exit.",
        is_eager=True,
        callback=_version_callback,
    )
):
    """Main entrypoint for global options."""
    return

# Register subcommands
app.add_typer(hello.app, name="hello")


def main() -> None:
    """CLI entry point."""
    app()


if __name__ == "__main__":
    app()
