"""Claude Code hook: response quality from outcome checks (tests, linter, type check, build)."""

from __future__ import annotations

import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

HOOK_PATH = Path(__file__).resolve().parents[1] / "integrations" / "claude_code" / "driftguard_hook.py"
spec = importlib.util.spec_from_file_location("driftguard_hook_quality", HOOK_PATH)
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)

USAGE = {
    "input_tokens": 12,
    "cache_creation_input_tokens": 3000,
    "cache_read_input_tokens": 450000,
    "output_tokens": 800,
}


def run(payload, state):
    return hook.build_events({"session_id": "abcdef1234567890", **payload}, state, False)


def iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


def assistant(request_id, timestamp, usage, blocks):
    return {
        "type": "assistant",
        "timestamp": timestamp,
        "requestId": request_id,
        "message": {"model": "claude-opus-5-5", "usage": usage, "content": blocks},
    }


def tool_event(command, response, event="PostToolUse"):
    return {
        "hook_event_name": event,
        "tool_name": "Bash",
        "tool_input": {"command": command},
        "tool_response": response,
        "tool_use_id": "t",
    }


def make_turn(tmp_path):
    """A turn with two model calls, read back through the real transcript reader."""
    started = datetime.now(timezone.utc) - timedelta(seconds=30)
    transcript = tmp_path / "t.jsonl"
    entries = [
        {"type": "user", "timestamp": iso(started), "message": {"content": "go"}},
        assistant("r1", iso(started + timedelta(seconds=2)), USAGE, [{"type": "tool_use", "id": "t1"}]),
        assistant("r2", iso(started + timedelta(seconds=9)), {"input_tokens": 100, "output_tokens": 50}, []),
    ]
    transcript.write_text("\n".join(json.dumps(e) for e in entries) + "\n", encoding="utf-8")
    return hook.turn_summary(transcript, started)


@pytest.mark.parametrize(
    "command, runner",
    [
        ("pytest -q", "pytest"),
        ("python -m pytest tests/ -x", "pytest"),
        (".venv/Scripts/python.exe -m pytest -q", "pytest"),
        ("PYTHONUTF8=1 python -m pytest", "pytest"),
        ("cd frontend && npx tsc --noEmit", "tsc"),
        ("(cd frontend && npm run build 2>&1 | tail -1)", "npm run build"),
        ("python -m ruff check . | tail -1", "ruff"),
        ("ruff check .", "ruff"),
        ("npm test", "npm test"),
        ("pnpm run lint", "pnpm run lint"),
        ("yarn build", "yarn build"),
        ("cargo test", "cargo test"),
        ("go test ./...", "go test"),
        ("make test", "make test"),
        ("git add -A && pytest", "pytest"),
    ],
)
def test_checking_commands_are_recognised(command, runner):
    assert hook.verification_command("Bash", {"command": command}) == runner


@pytest.mark.parametrize(
    "command",
    [
        "grep -rn pytest docs/",
        "echo pytest",
        "ls",
        "git commit -m 'fix pytest'",
        "cat pytest.ini",
        "python script.py",
        "npm install",
        "pip install pytest",
        "ruff format .",
        "git status && git log",
    ],
)
def test_other_commands_are_not_checks(command):
    assert hook.verification_command("Bash", {"command": command}) is None


def test_only_shell_tools_with_a_command_can_be_checks():
    assert hook.verification_command("Read", {"command": "pytest"}) is None
    assert hook.verification_command("Bash", "pytest") is None
    assert hook.verification_command("Bash", {"cmd": "pytest"}) is None


@pytest.mark.parametrize(
    "output",
    [
        "200 passed, 2 skipped, 1 warning in 26.16s",
        "All checks passed!",
        "",
        "0 failed, 5 passed",
        "Found 0 errors.",
    ],
)
def test_clean_output_is_a_pass(output):
    assert hook.verification_passed(False, {"stdout": output}) is True


@pytest.mark.parametrize(
    "output",
    [
        "198 passed, 2 failed in 20s",
        "FAILED tests/test_baseline.py::test_x - assert 1 == 2",
        "src/a.ts(3,4): error TS2322: Type 'string' is not assignable to type 'number'.",
        "Found 2 errors.",
        "Traceback (most recent call last):",
        "npm ERR! code ELIFECYCLE",
        "error during build:",
        "FAIL github.com/x/y 0.3s",
    ],
)
def test_failure_markers_in_the_output_are_a_fail_even_if_the_shell_said_success(output):
    assert hook.verification_passed(False, {"stdout": output}) is False


def test_a_failed_call_is_a_fail_whatever_it_printed():
    assert hook.verification_passed(True, {"stdout": "all good"}) is False


def test_checks_are_collected_per_turn_and_reset_by_the_next_prompt():
    state = {}
    run({"hook_event_name": "UserPromptSubmit", "prompt": "fix it"}, state)
    run(tool_event("ls", {"stdout": "a b"}), state)
    assert state["verifications"] == []
    run(
        tool_event("python -m pytest | tail -3", {"stdout": "1 failed, 5 passed"}), state
    )  # the pipe hides the exit code
    run(tool_event("python -m pytest | tail -3", {"stdout": "6 passed"}), state)
    assert state["verifications"] == [{"runner": "pytest", "passed": False}, {"runner": "pytest", "passed": True}]
    run({"hook_event_name": "UserPromptSubmit", "prompt": "next"}, state)
    assert state["verifications"] == []


def test_a_check_reported_as_a_failure_event_is_recorded_as_failed():
    state = {}
    run({"hook_event_name": "UserPromptSubmit", "prompt": "x"}, state)
    run(tool_event("pytest", {"error": "exit 1"}, event="PostToolUseFailure"), state)
    assert state["verifications"] == [{"runner": "pytest", "passed": False}]


@pytest.mark.parametrize(
    "error",
    [
        "Exit code 2\n/usr/bin/bash: -c: line 187: unexpected EOF while looking for matching `''",
        "Exit code 127\nbash: pytest: command not found",
        "The term 'pytest' is not recognized as the name of a cmdlet, function, script file, or operable program.",
        "'pytest' is not recognized as an internal or external command",
    ],
)
def test_a_command_that_never_started_is_not_a_failed_check(error):
    state = {}
    run({"hook_event_name": "UserPromptSubmit", "prompt": "x"}, state)
    payload = {**tool_event("pytest", {}, event="PostToolUseFailure"), "error": error}
    run(payload, state)
    assert state["verifications"] == []


def test_a_check_that_really_failed_is_still_counted_when_it_prints_system_looking_text():
    error = "Exit code 1\n=== 1 failed, 5 passed ===\nFileNotFoundError: No such file or directory: 'x'"
    state = {}
    run({"hook_event_name": "UserPromptSubmit", "prompt": "x"}, state)
    run({**tool_event("pytest", {}, event="PostToolUseFailure"), "error": error}, state)
    assert state["verifications"] == [{"runner": "pytest", "passed": False}]


def test_the_checks_of_one_turn_are_capped():
    state = {}
    run({"hook_event_name": "UserPromptSubmit", "prompt": "x"}, state)
    for _ in range(hook.MAX_VERIFICATIONS + 10):
        run(tool_event("pytest", {"stdout": "1 passed"}), state)
    assert len(state["verifications"]) == hook.MAX_VERIFICATIONS


def test_stop_clears_the_checks():
    state = {}
    run({"hook_event_name": "UserPromptSubmit", "prompt": "x"}, state)
    run(tool_event("pytest", {"stdout": "1 passed"}), state)
    run({"hook_event_name": "Stop"}, state)
    assert state["verifications"] == []


def test_a_passing_last_check_scores_the_turn_one_on_its_last_model_call_only(tmp_path):
    checks = [{"runner": "pytest", "passed": False}, {"runner": "pytest", "passed": True}]
    first, last = hook.telemetry_events(make_turn(tmp_path), "s-p1", checks)
    assert "response_quality" not in first  # a turn counts once, however many model calls it made
    assert last["response_quality"] == 1.0
    assert last["metadata"]["quality_basis"] == "last_verification_run"
    assert last["metadata"]["verification_runs"] == 2 and last["metadata"]["verification_passed"] == 1
    assert last["metadata"]["verification_runner"] == "pytest"
    assert "retrieval_score" not in first and "retrieval_score" not in last


def test_a_failing_last_check_scores_the_turn_zero(tmp_path):
    checks = [{"runner": "tsc", "passed": True}, {"runner": "tsc", "passed": False}]
    assert hook.telemetry_events(make_turn(tmp_path), "s-p1", checks)[-1]["response_quality"] == 0.0


def test_a_turn_with_no_check_gets_no_score(tmp_path):
    for checks in (None, []):
        events = hook.telemetry_events(make_turn(tmp_path), "s-p1", checks)
        assert all("response_quality" not in e for e in events)
        assert all("quality_basis" not in e["metadata"] for e in events)


def test_the_score_reaches_the_dashboard_as_the_average_quality_with_no_retrieval(tmp_path, client, project):
    passing = hook.telemetry_events(make_turn(tmp_path), "s-p1", [{"runner": "pytest", "passed": True}])
    failing = hook.telemetry_events(make_turn(tmp_path), "s-p2", [{"runner": "pytest", "passed": False}])
    unscored = hook.telemetry_events(make_turn(tmp_path), "s-p3", [])
    events = passing + failing + unscored
    response = client.post(
        f"/events/{project['project_id']}/batch", json={"events": events}, headers=project["key_headers"]
    )
    assert response.status_code == 200 and response.json()["ingested"] == 6
    summary = client.get(f"/projects/{project['project_id']}/summary", headers=project["key_headers"]).json()
    assert summary["averages"]["response_quality"] == 0.5  # two checked turns, one passed and one failed
    assert summary["spread"]["response_quality"]["n"] == 2  # the four unscored events are not in it
    assert summary["averages"]["retrieval_score"] is None
    assert summary["spread"]["retrieval_score"]["n"] == 0


def test_scoring_from_checks_can_be_switched_off():
    state = {"verifications": [{"runner": "pytest", "passed": True}]}
    assert hook.turn_checks(state, {}) == [{"runner": "pytest", "passed": True}]
    assert hook.turn_checks(state, {"quality_from_checks": True}) == [{"runner": "pytest", "passed": True}]
    assert hook.turn_checks(state, {"quality_from_checks": False}) == []
    assert hook.turn_checks({}, {}) == []
