1️⃣ Install mypy as a dev dependency

If you’re using pip:

pip install --upgrade pip
pip install --save-dev mypy

Or if using poetry:

poetry add --dev mypy


---

2️⃣ Add type hints to cli.py

Example cli.py before type hints:

import click
from helpers import process_data

@click.command()
@click.argument("input_file")
def main(input_file):
    result = process_data(input_file)
    print(result)

With type hints:

import click
from helpers import process_data

@click.command()
@click.argument("input_file")
def main(input_file: str) -> None:
    """Main CLI entry point."""
    result: str = process_data(input_file)
    print(result)

And a helper function (helpers.py) with hints:

def process_data(file_path: str) -> str:
    """Process the input file and return a string result."""
    with open(file_path, "r") as f:
        data: str = f.read()
    return data.upper()

Tips:

str, int, float, bool for primitives

list[str], dict[str, int] for collections (Python 3.9+ syntax)

Optional[str] for values that may be None

Functions that don’t return anything → -> None



---

3️⃣ Update CI to run mypy

If using GitHub Actions, your lint step might look like this:

name: Lint & Type Check

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.11"
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install mypy
      - name: Run mypy
        run: mypy cli.py helpers.py
      - name: Run flake8
        run: flake8 .


---

4️⃣ Run mypy locally to catch errors

mypy cli.py helpers.py

You may see errors like:

helpers.py:7: error: Incompatible types in assignment (expression has type "int", variable has type "str")

Fix by correcting type hints or handling conversions.


---

5️⃣ Optional: Create mypy.ini config

[mypy]
python_version = 3.11
ignore_missing_imports = True
strict = True

strict = True enables full type checking

ignore_missing_imports = True avoids errors for 3rd-party libs without stubs



---

✅ By the end, you’ll have:

1. Proper type hints in cli.py and helpers.


2. mypy as a dev dependency.


3. CI automatically failing on type errors.


4. Better maintainable, self-documenting code.



