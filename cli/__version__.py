import os
import re
from importlib.metadata import PackageNotFoundError, version as pkg_version


APP_NAME = "101-linux"


def _discover_package_version() -> str:
    """Discover version from installed package or local setup.py when running from source.

    - Prefer the installed distribution version (if available)
    - Fallback to parsing version from cli/setup.py (source checkout)
    - Lastly, fallback to "0.0.0" if nothing else is found
    """
    try:
        return pkg_version("linux-commands-cli")
    except PackageNotFoundError:
        pass

    setup_path = os.path.join(os.path.dirname(__file__), "setup.py")
    if os.path.exists(setup_path):
        try:
            with open(setup_path, "r", encoding="utf-8") as f:
                content = f.read()
            match = re.search(r"version=\"([^\"]+)\"", content)
            if match:
                return match.group(1)
        except Exception:
            pass

    return "0.0.0"


__version__ = _discover_package_version()


def get_version_string() -> str:
    return f"{APP_NAME} v{__version__}"


