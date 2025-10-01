#!/usr/bin/env python3
"""Basic tests for the CLI module."""

import os
import subprocess
import sys


def test_cli_help():
    """Test that the CLI shows help."""
    result = subprocess.run(
        [sys.executable, "cli.py", "--help"],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(__file__),
    )
    assert result.returncode == 0
    assert "101 Linux Commands CLI" in result.stdout


def test_hello_command():
    """Test the hello command."""
    result = subprocess.run(
        [sys.executable, "cli.py", "hello", "greet"],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(__file__),
    )
    assert result.returncode == 0
    assert "Hello, World!" in result.stdout


def test_hello_command_with_name():
    """Test the hello command with a custom name."""
    result = subprocess.run(
        [sys.executable, "cli.py", "hello", "greet", "--name", "Linux"],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(__file__),
    )
    assert result.returncode == 0
    assert "Hello, Linux!" in result.stdout


def test_hello_help():
    """Test the hello command help."""
    result = subprocess.run(
        [sys.executable, "cli.py", "hello", "--help"],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(__file__),
    )
    assert result.returncode == 0
    assert "Hello command group" in result.stdout


def test_list_command():
    """Test the list command."""
    result = subprocess.run(
        [sys.executable, "cli.py", "list"],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(__file__),
    )
    assert result.returncode == 0
    assert "ls - List directory contents." in result.stdout
    assert "cd - Change directory." in result.stdout
    assert "pwd - Print working directory." in result.stdout
    assert "cat - Concatenate and display files." in result.stdout


if __name__ == "__main__":
    test_cli_help()
    test_hello_command()
    test_hello_command_with_name()
    test_hello_help()
    test_list_command()
    print("✅ All tests passed!")
