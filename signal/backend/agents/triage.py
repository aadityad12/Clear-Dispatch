import json
import logging
import re
from dataclasses import dataclass

import anthropic

import state
from ws.hub import manager

_log = logging.getLogger("clear_dispatch.triage")

_client = anthropic.AsyncAnthropic()


@dataclass
class TriageResult:
    severity: str       # CRITICAL | URGENT | STANDARD
    incident_type: str  # fire | evacuation | medical | structure | other
    zone: str
    vulnerable: bool
    reasoning: str


def _extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    m = re.search(r"\{.*?\}", text, re.DOTALL)
    if m:
        return json.loads(m.group(0))
    raise ValueError("no JSON in response")


async def triage_agent(call: dict) -> TriageResult:
    zone = call.get("zone", "YL-01")
    vuln_score = state.vulnerability_data.get(zone, 0.5)

    await manager.broadcast("AGENT_STATUS", {
        "agent": "TRIAGE",
        "status": "RUNNING",
        "last_action": f"Classifying call {call['id']}",
    })

    prompt = f"""You are a 911 triage AI. Classify this emergency call.

Call ID: {call['id']}
Zone: {zone} (vulnerability score: {vuln_score:.2f} — 0=low, 1=high)
Reported type: {call.get('reported_type', 'unknown')}
Description: {call.get('description', '')}
System mode: {state.system_state['mode']}

Respond with ONLY a JSON object:
{{
  "severity": "CRITICAL|URGENT|STANDARD",
  "incident_type": "fire|evacuation|medical|structure|other",
  "vulnerable": true|false,
  "reasoning": "one sentence"
}}

Rules:
- CRITICAL: imminent life threat, structure fire spreading, unresponsive patient, aerial suppression needed
- URGENT: evacuations, mobility-impaired residents, smoke inhalation
- STANDARD: property threat, contained smoke, non-urgent reports
- vulnerable=true if zone score > 0.6 OR description mentions elderly/disabled/children/assisted living"""

    severity = "URGENT"
    incident_type = call.get("reported_type", "fire")
    vulnerable = vuln_score > 0.6
    reasoning = "Defaulted due to parse error"

    try:
        response = await _client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        data = _extract_json(response.content[0].text)
        severity = data.get("severity", "URGENT")
        incident_type = data.get("incident_type", incident_type)
        vulnerable = bool(data.get("vulnerable", vulnerable))
        reasoning = data.get("reasoning", "")
    except Exception as e:
        _log.error("Triage parse error for call %s: %s", call["id"], e)
        reasoning = f"Parse error: {e}"

    result = TriageResult(
        severity=severity,
        incident_type=incident_type,
        zone=zone,
        vulnerable=vulnerable,
        reasoning=reasoning,
    )

    await manager.broadcast("AGENT_STATUS", {
        "agent": "TRIAGE",
        "status": "COMPLETE",
        "last_action": f"Call {call['id']}: {severity} — {incident_type}",
    })

    return result
