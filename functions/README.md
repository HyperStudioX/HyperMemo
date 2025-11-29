# HyperMemo Cloud Functions (Python)

These Firebase Functions are implemented in Python 3.13 and managed with [uv](https://github.com/astral-sh/uv).

## Development

```bash
cd functions
UV_VENV=venv uv sync  # creates ./functions/venv with the pinned interpreter
UV_VENV=venv uv run functions-framework --target bookmarks
```

> **Note:** Firebase’s deploy tooling still requires a `requirements.txt`. We keep
> a stub file containing `.` so the deploy step installs this package (and its
> pyproject-defined dependencies) while uv remains the primary dependency manager.

Set the required environment variables (e.g. `OPENAI_API_KEY`, `AI_PROVIDER`, `VERTEX_LOCATION`, etc.) before running locally. Deploy with Firebase as usual:

```bash
firebase deploy --only functions
```
