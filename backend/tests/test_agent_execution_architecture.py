"""Tests for LangGraph architecture selection."""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import agent_execution


def test_architecture_selection_defaults_to_architecture_1(monkeypatch):
    monkeypatch.delenv("LANGGRAPH_ARCHITECTURE", raising=False)

    name, runner = agent_execution._select_architecture_runner()

    assert name == "architecture_1"
    assert runner is agent_execution.run_architecture_1


def test_architecture_selection_supports_architecture_2(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_ARCHITECTURE", "2")

    name, runner = agent_execution._select_architecture_runner()

    assert name == "architecture_2"
    assert runner is agent_execution.run_architecture_2
