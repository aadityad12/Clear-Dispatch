from typing import Any

system_state: dict[str, Any] = {
    "mode": "ASSISTED",
    "surge_threshold": 10,
    "surge_started_at": None,
    "call_timestamps": [],
    "paused": False,
}

call_queue: list[dict] = []
incident_log: list[dict] = []
hold_queue: dict[str, dict] = {}
simulator_lambda: dict = {"value": 2.0}

# Loaded from data/ on startup
resources: list[dict] = []
vulnerability_data: dict[str, float] = {}
fire_perimeter: dict = {}

# Live-call streaming state (Feature 1)
live_transcripts: dict[str, str] = {}     # call_id → accumulated transcript
live_extractions: dict[str, dict] = {}    # call_id → latest extracted fields
