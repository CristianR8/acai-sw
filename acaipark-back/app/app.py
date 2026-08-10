from __future__ import annotations

from pathlib import Path

# When you run from inside `app/` (cwd is this folder), `uvicorn app.main:app`
# fails because Python can't resolve the top-level `app` package (the parent
# directory isn't on `sys.path`). This shim makes `import app.main` work by
# turning this module into a package via `__path__`.
__path__ = [str(Path(__file__).resolve().parent)]

