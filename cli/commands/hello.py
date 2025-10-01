import typer

app = typer.Typer(help="Hello command group")


@app.callback(invoke_without_command=True)
def greet(name: str = "World"):
    """Say hello to someone."""
    typer.echo(f"Hello, {name}!")
