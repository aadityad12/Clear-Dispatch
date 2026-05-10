import os
from datetime import datetime, timezone

import anthropic
import httpx

import state
from ws.hub import manager

_client = anthropic.AsyncAnthropic()


async def relay_agent(call: dict, triage, resource_result: dict) -> None:
    await manager.broadcast("AGENT_STATUS", {
        "agent": "RELAY",
        "status": "RUNNING",
        "last_action": f"Generating briefing for call {call['id']}",
    })

    # Generate dispatcher briefing via Claude
    unit_id = resource_result.get("unit_id") or "N/A"
    eta = resource_result.get("eta_minutes") or "?"

    prompt = f"""Generate a concise dispatcher briefing (under 25 words, clipped and direct):

Incident {call['id']}. Severity: {triage.severity}. Zone: {triage.zone}. Type: {triage.incident_type}. Unit {unit_id} dispatched. ETA {eta} minutes.

Format: "Incident [ID]. [Severity]. [Zone]. [Incident type]. Unit [unit_id] dispatched. ETA [N] minutes."
Return ONLY the briefing sentence, nothing else."""

    briefing_text = (
        f"Incident {call['id']}. {triage.severity}. {triage.zone}. "
        f"{triage.incident_type}. Unit {unit_id} dispatched. ETA {eta} minutes."
    )

    try:
        response = await _client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=128,
            messages=[{"role": "user", "content": prompt}],
        )
        briefing_text = response.content[0].text.strip()
    except Exception as e:
        # Keep the template fallback
        pass

    # ElevenLabs TTS
    audio_url = None
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")
    if elevenlabs_key:
        voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        try:
            async with httpx.AsyncClient(timeout=15) as http:
                resp = await http.post(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                    headers={"xi-api-key": elevenlabs_key, "Content-Type": "application/json"},
                    json={"text": briefing_text, "model_id": "eleven_monolingual_v1"},
                )
                resp.raise_for_status()
                os.makedirs("audio", exist_ok=True)
                audio_path = f"audio/{call['id']}.mp3"
                with open(audio_path, "wb") as f:
                    f.write(resp.content)
                audio_url = f"/audio/{call['id']}.mp3"
        except Exception as e:
            print(f"[RELAY] ElevenLabs error: {e}")
            audio_url = None

    # Build audit record
    audit = {
        "call_id": call["id"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "triage": {
            "severity": triage.severity,
            "incident_type": triage.incident_type,
            "zone": triage.zone,
            "vulnerable": triage.vulnerable,
            "reasoning": triage.reasoning,
        },
        "resource": {
            "unit_id": resource_result.get("unit_id"),
            "eta_minutes": resource_result.get("eta_minutes"),
            "requires_hold": resource_result.get("requires_hold", False),
        },
        "briefing_text": briefing_text,
        "audio_url": audio_url,
        "dispatcher_override": False,
        "hold_confirmed": resource_result.get("hold_confirmed"),
    }
    state.incident_log.append(audit)

    # Update call queue with briefing text
    for c in state.call_queue:
        if c["id"] == call["id"]:
            c["briefing_text"] = briefing_text
            break

    await manager.broadcast("BRIEFING_READY", {
        "call_id": call["id"],
        "text": briefing_text,
        "audio_url": audio_url,
    })

    await manager.broadcast("INCIDENT_REPORT", {
        "call_id": call["id"],
        "report": audit,
    })

    await manager.broadcast("AGENT_STATUS", {
        "agent": "RELAY",
        "status": "COMPLETE",
        "last_action": f"Briefing ready for call {call['id']}",
    })
