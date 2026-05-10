import asyncio
import logging
from datetime import datetime, timezone, timedelta

import state
from ws.hub import manager

_log = logging.getLogger("clear_dispatch.monitor")


def _parse_ts(ts: str) -> datetime:
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def monitor_loop():
    while True:
        await asyncio.sleep(5)

        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=60)

        state.system_state["call_timestamps"] = [
            ts for ts in state.system_state["call_timestamps"]
            if _parse_ts(ts) > cutoff
        ]

        rate = float(len(state.system_state["call_timestamps"]))
        threshold = state.system_state["surge_threshold"]
        current_mode = state.system_state["mode"]
        now_iso = now.isoformat()

        last_action = f"Monitoring: {rate:.1f} calls/min (threshold: {threshold})"
        status = "IDLE"

        if rate > threshold and current_mode == "ASSISTED":
            state.system_state["mode"] = "SURGE"
            state.system_state["surge_started_at"] = now_iso
            await manager.broadcast("MODE_CHANGE", {"mode": "SURGE", "timestamp": now_iso})
            last_action = f"Surge detected: {rate:.1f} calls/min"
            status = "COMPLETE"
            _log.warning("MODE → SURGE (%.1f calls/min, threshold=%d)", rate, threshold)

        elif current_mode == "SURGE":
            surge_started = state.system_state.get("surge_started_at")
            if rate <= threshold and surge_started:
                try:
                    elapsed = (now - _parse_ts(surge_started)).total_seconds()
                    if elapsed > 120:
                        state.system_state["mode"] = "ASSISTED"
                        await manager.broadcast("MODE_CHANGE", {"mode": "ASSISTED", "timestamp": now_iso})
                        last_action = f"Surge ended after {elapsed:.0f}s"
                        status = "COMPLETE"
                        _log.info("MODE → ASSISTED (surge ended after %.0fs)", elapsed)
                    else:
                        last_action = f"Surge active {elapsed:.0f}s, rate {rate:.1f}/min"
                        status = "RUNNING"
                except Exception:
                    status = "RUNNING"
            else:
                last_action = f"Surge active: {rate:.1f} calls/min"
                status = "RUNNING"

        await manager.broadcast("AGENT_STATUS", {
            "agent": "MONITOR",
            "status": status,
            "last_action": last_action,
        })
