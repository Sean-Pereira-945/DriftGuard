"""Configuration for the MCP gateway, loaded from flags, env vars and a file.

Resolution order for each value: an explicit CLI flag, then an environment
variable, then a JSON config file, then the default. The config file uses the
same keys as the Claude Code integration's ``driftguard.json`` so one file can
serve both.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ENV_API_KEY = "DRIFTGUARD_API_KEY"
ENV_PROJECT_ID = "DRIFTGUARD_PROJECT_ID"
ENV_BASE_URL = "DRIFTGUARD_BASE_URL"
ENV_ENVIRONMENT = "DRIFTGUARD_ENVIRONMENT"

DEFAULT_BASE_URL = "http://127.0.0.1:8000"
DEFAULT_ENVIRONMENT = "prod"
DEFAULT_FLUSH_INTERVAL = 2.0


class ConfigError(ValueError):
    """Raised when required configuration is missing or malformed."""


@dataclass
class GatewayConfig:
    """Everything the gateway needs to report to a DriftGuard server.

    Attributes:
        api_key: The project's ``dg_live_...`` ingestion key.
        project_id: The project to report to.
        base_url: The DriftGuard server URL.
        environment: The environment tag applied to every event.
        task_id: The task all of this session's tool calls belong to. Defaults
            to a name derived from the downstream command.
        agent_name: The agent name on each event. Defaults to ``project_id``.
        capture_content: Send tool arguments and results as content previews. The
            server stores them only for projects with content storage on.
        flush_interval: Seconds between background syncs of queued events.
    """

    api_key: str
    project_id: str
    base_url: str = DEFAULT_BASE_URL
    environment: str = DEFAULT_ENVIRONMENT
    task_id: str | None = None
    agent_name: str | None = None
    capture_content: bool = False
    flush_interval: float = DEFAULT_FLUSH_INTERVAL

    @classmethod
    def resolve(
        cls,
        *,
        config_path: str | os.PathLike[str] | None = None,
        api_key: str | None = None,
        project_id: str | None = None,
        base_url: str | None = None,
        environment: str | None = None,
        task_id: str | None = None,
        agent_name: str | None = None,
        capture_content: bool | None = None,
        flush_interval: float | None = None,
        env: dict[str, str] | None = None,
    ) -> GatewayConfig:
        """Build a config from flags, environment and an optional JSON file.

        Explicit (non-``None``) arguments win, then the matching environment
        variable, then the file, then the default. Raises :class:`ConfigError`
        when the API key or project id is missing anywhere.
        """
        env = os.environ if env is None else env
        file_values = _read_file(config_path)

        def pick(arg: Any, env_name: str | None, file_key: str, default: Any = None) -> Any:
            if arg is not None:
                return arg
            if env_name and env.get(env_name):
                return env[env_name]
            if file_key in file_values and file_values[file_key] is not None:
                return file_values[file_key]
            return default

        resolved_key = pick(api_key, ENV_API_KEY, "api_key")
        resolved_project = pick(project_id, ENV_PROJECT_ID, "project_id")
        if not resolved_key:
            raise ConfigError("An API key is required (--api-key, DRIFTGUARD_API_KEY, or the config file's api_key).")
        if not resolved_project:
            raise ConfigError(
                "A project id is required (--project-id, DRIFTGUARD_PROJECT_ID, or the config file's project_id)."
            )

        capture = capture_content if capture_content is not None else bool(file_values.get("capture_content", False))
        interval = (
            flush_interval
            if flush_interval is not None
            else float(file_values.get("flush_interval", DEFAULT_FLUSH_INTERVAL))
        )
        return cls(
            api_key=str(resolved_key),
            project_id=str(resolved_project),
            base_url=str(pick(base_url, ENV_BASE_URL, "base_url", DEFAULT_BASE_URL)).rstrip("/"),
            environment=str(pick(environment, ENV_ENVIRONMENT, "environment", DEFAULT_ENVIRONMENT)),
            task_id=pick(task_id, None, "task_id"),
            agent_name=pick(agent_name, None, "agent_name"),
            capture_content=capture,
            flush_interval=interval,
        )


def _read_file(path: str | os.PathLike[str] | None) -> dict[str, Any]:
    if path is None:
        return {}
    text = Path(path).read_text(encoding="utf-8")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ConfigError(f"Config file {path} is not valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise ConfigError(f"Config file {path} must hold a JSON object.")
    return data
