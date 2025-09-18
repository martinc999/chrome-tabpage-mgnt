# chrome_tabpage_mgnt

A Python project created with uv and Ruff.

## Installation

```bash
# Install dependencies
uv sync

# Install in development mode
uv pip install -e .
```

## Usage

```bash
# Run the main module
uv run python src/chrome_tabpage_mgnt/main.py

# Or use the installed script
uv run chrome_tabpage_mgnt
```

## Development

```bash
# Run tests
uv run pytest

# Format and lint code with Ruff
uv run ruff format src tests
uv run ruff check src tests

# Auto-fix issues
uv run ruff check --fix src tests
```

## Project Structure

```
chrome_tabpage_mgnt/
├── src/chrome_tabpage_mgnt/
│   ├── __init__.py
│   └── main.py
├── tests/
│   └── test_main.py
├── docs/
├── .vscode/
│   ├── settings.json
│   ├── launch.json
│   ├── tasks.json
│   └── extensions.json
├── pyproject.toml
├── requirements.txt
├── requirements-dev.txt
└── README.md
```
