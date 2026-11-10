"""The stdio proxy that forwards MCP traffic and taps ``tools/call`` executions.

:class:`MessageTap` is the pure part: feed it the client's outgoing messages and
the server's incoming messages, and it records each matched ``tools/call`` as a
DriftGuard agent event through an :class:`~driftguard.adapters.mcp.MCPMiddleware`.
It is byte-transparent — a message it cannot parse is ignored for tapping, never
altered.

:class:`MCPGateway` wires the tap to a real downstream MCP server launched as a
subprocess, pumping bytes in both directions on threads so it works the same on
Windows and POSIX. Nothing is ever written to the proxy's stdout except the
bytes the downstream server sent, because that stream *is* the MCP channel back
to the client.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess  # nosec B404 - launching the downstream MCP server is this module's purpose
import sys
import threading
import time
from typing import IO, Any

from driftguard.adapters.mcp import MCPMiddleware
from driftguard.client import DriftGuardClient

logger = logging.getLogger("driftguard.gateway")


class MessageTap:
    """Record MCP ``tools/call`` request/response pairs seen on a message stream.

    The tap is thread-safe: the two pump directions call
    :meth:`on_client_message` and :meth:`on_server_message` from different
    threads, so the pending-request table is guarded by a lock.
    """

    def __init__(self, middleware: MCPMiddleware) -> None:
        self._middleware = middleware
        self._pending: dict[str, tuple[dict[str, Any], float]] = {}
        self._lock = threading.Lock()

    def on_client_message(self, raw: bytes) -> None:
        """Note an outgoing ``tools/call`` request so its response can be timed."""
        message = _parse(raw)
        if not isinstance(message, dict) or message.get("method") != "tools/call":
            return
        call_id = message.get("id")
        if call_id is None:
            return  # a notification, never answered; nothing to pair.
        with self._lock:
            self._pending[str(call_id)] = (message, time.perf_counter())

    def on_server_message(self, raw: bytes) -> None:
        """Match an incoming response to a pending ``tools/call`` and record it."""
        message = _parse(raw)
        if not isinstance(message, dict) or "id" not in message:
            return
        key = str(message.get("id"))
        with self._lock:
            pending = self._pending.pop(key, None)
        if pending is None:
            return
        request, started = pending
        duration_ms = (time.perf_counter() - started) * 1000
        try:
            self._middleware.intercept_response(request, message, duration_ms=duration_ms)
        except Exception:  # pragma: no cover - never let telemetry break the proxy
            logger.exception("Failed to record an MCP tool call")

    @property
    def pending_count(self) -> int:
        with self._lock:
            return len(self._pending)


def _parse(raw: bytes) -> Any:
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def resolve_command(command: list[str]) -> list[str]:
    """Resolve the server command's executable so PATH lookups and Windows wrappers work.

    ``npx``/``uvx`` servers resolve to a ``.cmd`` on Windows, which ``CreateProcess``
    cannot run directly, so those are wrapped through the command interpreter. A
    command that can't be found is passed through unchanged so :class:`subprocess.Popen`
    raises a clear ``FileNotFoundError``.
    """
    found = shutil.which(command[0])
    if found is None:
        return command
    if sys.platform == "win32" and found.lower().endswith((".cmd", ".bat")):
        comspec = os.environ.get("COMSPEC", "cmd.exe")
        return [comspec, "/c", found, *command[1:]]
    return [found, *command[1:]]


class MCPGateway:
    """Proxy an MCP stdio server, recording its tool calls to DriftGuard.

    Args:
        command: The downstream server command and its arguments.
        client: A configured :class:`DriftGuardClient` (its queue is flushed
            periodically and on shutdown).
        middleware: The MCP middleware whose ``task_id`` names this session.
        stdin / stdout: Binary streams to read client messages from and write
            server messages to. Default to the process's own stdio.
        flush_interval: Seconds between background syncs.
        session_events: Emit ``session_start`` / ``session_end`` activity.
    """

    def __init__(
        self,
        command: list[str],
        client: DriftGuardClient,
        middleware: MCPMiddleware,
        *,
        stdin: IO[bytes] | None = None,
        stdout: IO[bytes] | None = None,
        flush_interval: float = 2.0,
        session_events: bool = True,
    ) -> None:
        if not command:
            raise ValueError("A downstream server command is required.")
        self.command = command
        self.client = client
        self.middleware = middleware
        self.tap = MessageTap(middleware)
        self._stdin = stdin
        self._stdout = stdout
        self.flush_interval = flush_interval
        self.session_events = session_events
        self._stop = threading.Event()

    def run(self) -> int:
        """Start the downstream server and proxy until it or the client exits.

        Returns the downstream server's exit code.
        """
        stdin = self._stdin or sys.stdin.buffer
        stdout = self._stdout or sys.stdout.buffer

        command = resolve_command(self.command)
        logger.info("Starting MCP server: %s", " ".join(self.command))
        # stderr is inherited so the downstream server's own logs still reach the user.
        process = subprocess.Popen(  # noqa: S603  # nosec B603 - operator-supplied command, shell=False by design
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            bufsize=0,
        )
        assert process.stdin is not None and process.stdout is not None

        if self.session_events:
            self._record_session("session_start")

        flusher = threading.Thread(target=self._flush_loop, name="dg-flush", daemon=True)
        to_server = threading.Thread(
            target=self._pump,
            name="dg-client-to-server",
            args=(stdin, process.stdin, self.tap.on_client_message, True),
            daemon=True,
        )
        flusher.start()
        to_server.start()

        # Pump server→client on this thread; it ends when the server closes stdout.
        try:
            self._pump(process.stdout, stdout, self.tap.on_server_message, False)
        finally:
            self._stop.set()
            returncode = process.wait()
            if self.session_events:
                self._record_session("session_end")
            self._final_flush()
            logger.info("MCP server exited with code %s", returncode)
        return returncode

    def _pump(self, source: IO[bytes], sink: IO[bytes], tap: Any, closes_sink: bool) -> None:
        """Forward newline-delimited messages from source to sink, tapping each one."""
        try:
            for line in source:
                tap(line)
                try:
                    sink.write(line)
                    sink.flush()
                except (BrokenPipeError, ValueError, OSError):
                    break  # the other side went away; stop this direction.
        except (ValueError, OSError):
            pass
        finally:
            if closes_sink:
                try:
                    sink.close()  # EOF to the downstream server so it can exit.
                except OSError:
                    pass

    def _flush_loop(self) -> None:
        while not self._stop.wait(self.flush_interval):
            self._sync()

    def _final_flush(self) -> None:
        self._sync()

    def _sync(self) -> None:
        try:
            self.client.sync_agent_events(self.client.project_id)
        except Exception:  # pragma: no cover - a failed sync keeps events queued
            logger.debug("Agent-event sync failed; events stay queued", exc_info=True)

    def _record_session(self, kind: str) -> None:
        try:
            self.client.capture_agent_event(task_id=self.middleware.task_id, kind=kind)
        except Exception:  # pragma: no cover
            logger.debug("Could not record %s", kind, exc_info=True)
