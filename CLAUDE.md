# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: SIGNAL

Human-in-the-loop emergency dispatch support system for wildfire surge events. Four AI agents (MONITOR, TRIAGE, RESOURCE, RELAY) assist a 911 dispatcher — never callers. This is a HackDavis 2026 project.

**This session is Person 2 — frontend owner.** Responsible for all GitHub issues labeled `[Frontend]` (issues #9–15 in `aadityad12/HackDavis26`).

## Commands

```bash
# Frontend (Person 2's domain)
cd signal/frontend && npm install
npm run dev          # http://localhost:5173
npm run build        # tsc -b && vite build

# Backend (Person 1's domain — must be running for WS/API)
cd signal/backend && uv sync
uvicorn main:app --reload --port 8000
```

## Shared Contract — Do Not Deviate

| Concern | Value |
|---|---|
| Backend port | `8000` |
| Frontend port | `5173` |
| WebSocket path | `/ws` |
| API proxy | Vite proxies `/api/*` → `http://localhost:8000` (strips `/api` prefix) |
| WS env var | `VITE_WS_URL=ws://localhost:8000/ws` in `signal/frontend/.env` |

**Enum values** (exact strings — backend and frontend must match):
- Mode: `ASSISTED` | `SURGE`
- Severity: `CRITICAL` | `URGENT` | `STANDARD` | `PENDING`
- Agent names: `MONITOR` | `TRIAGE` | `RESOURCE` | `RELAY`
- Agent status: `IDLE` | `RUNNING` | `COMPLETE` | `ERROR`
- Heavy asset types: `air_tanker` | `heavy_rescue` | `hazmat`

**WebSocket messages** (backend → frontend):
```
MODE_CHANGE     { mode, timestamp }
CALL_ADDED      { id, severity, zone, vulnerable, incident_type }
AGENT_STATUS    { agent, status, last_action }
UNIT_DISPATCHED { call_id, unit_id, eta_minutes }
HOLD_REQUIRED   { call_id, unit_id, asset_type, hold_id }
HOLD_RESOLVED   { hold_id, action: "CONFIRMED"|"CANCELLED" }
BRIEFING_READY  { call_id, text, audio_url }
INCIDENT_REPORT { call_id, report }
```

**REST endpoints** (frontend calls via `/api` proxy):
```
POST /api/override
POST /api/confirm-hold   body: { hold_id }
POST /api/cancel-hold    body: { hold_id }
POST /api/demo/start
POST /api/demo/trigger-surge
POST /api/demo/reset
```

## Frontend Architecture

**Stack**: React 18 + Vite 6 + TypeScript 5 + Tailwind 3 + Leaflet 1.9 (vanilla, not react-leaflet)

**State flow**: `useWebSocket` hook → dispatches `Action` → `useReducer(reducer, initialState)` in `App.tsx` → props to components. The reducer (`src/store/reducer.ts`) is pure — no side effects. All WS message handling lives there.

**Layout**: Full-viewport flex column — `ModeIndicator` (fixed top banner) → 3-column grid (CallQueue | MapView | AgentCards+BriefingPanel) → `AuditTrail` (collapsible bottom) → `DemoControls` (fixed bottom bar). `HoldModal` is a `z-50` fullscreen overlay when `activeHold !== null`. `OverrideButton` is fixed-position, only visible in SURGE mode.

**Visual design**: No dark mode, no gradients, no heavy shadows. Background `#F8FAFC`, panels white with `border border-slate-200`. Primary blue `#1D4ED8`, SURGE red `#DC2626`. Font: Inter. Monospace only for IDs and timestamps.

## Implementation Gotchas

- **Leaflet CSS**: import `leaflet/dist/leaflet.css` in `src/index.css`, not in the component — marker icons break otherwise.
- **Leaflet map height**: container div must have `style={{ height: '400px' }}` or the map won't render.
- **Leaflet double-init**: clean up the map instance on unmount in the `useEffect` return.
- **Audio autoplay**: browsers block `audio.play()` without prior user interaction — wrap in `try/catch` and show a "Click to play briefing" fallback button.
- **`CALL_ADDED` deduplication**: this message fires twice per call (once as `PENDING`, once with real severity). The reducer deduplicates by `id` — components just render `state.calls`.
- **HoldModal**: no close-on-backdrop-click — dispatcher must explicitly confirm or cancel.
- **WS reconnect**: `useWebSocket` retries every 3s automatically. `ModeIndicator` shows connection status.

## Demo Flow (for judges)

Reset → Start Demo (2 normal calls) → Trigger Surge (SURGE banner + 4 auto-triaged calls) → ElevenLabs voice briefing (or text fallback) → HOLD modal on heavy asset → Override → show Audit Trail.

## GitHub Issues Ownership

All `[Frontend]` issues (#9–15) in `aadityad12/HackDavis26`:
- #9 Project scaffold (Vite + React + Tailwind + types + reducer)
- #10 WebSocket hook with auto-reconnect
- #11 ModeIndicator and AgentCards
- #12 CallQueue
- #13 MapView (Leaflet + Park Fire perimeter)
- #14 OverrideButton and HoldModal
- #15 BriefingPanel, AuditTrail, DemoControls

## Agents & Skills Available

- `Ubiquitous` agent: run whenever new technology or domain terms are introduced — extracts DDD-style glossary to `UBIQUITOUS_LANGUAGE.md`
- `grill-me` skill (`/grill-me`): stress-test a plan or design before implementing
