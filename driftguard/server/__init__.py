"""DriftGuard server (FastAPI). Install with ``pip install "driftguard[server]"``.

The server's dependencies (FastAPI, uvicorn, SQLAlchemy, ...) are an optional
extra, so this package is imported lazily: ``from driftguard.server import
create_app`` works once the extra is installed, and merely importing
``driftguard.server`` (for example to run the ``driftguard-server`` entry point)
never pulls them in, so a missing extra fails with a clear message instead of an
import traceback.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

__all__ = ["Settings", "create_app"]

if TYPE_CHECKING:  # pragma: no cover - typing only
    from .app import create_app
    from .settings import Settings


def __getattr__(name: str) -> Any:
    if name == "create_app":
        from .app import create_app

        return create_app
    if name == "Settings":
        from .settings import Settings

        return Settings
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
