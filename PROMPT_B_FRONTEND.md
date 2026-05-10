# SIGNAL — Frontend Implementation Prompt (Person 2)

You are implementing the complete frontend dashboard for **SIGNAL**, a human-in-the-loop emergency dispatch support system for wildfire surge events. This is for HackDavis 2026.

**Your deliverable**: The complete `signal/frontend/` directory. When done, `npm run dev` must start a working dashboard on `http://localhost:5173`.

You can work fully independently of the backend. The WebSocket and API types are fixed — implement against the contract below and it will work when Person 1's backend is running.

---

## Prerequisites

- Node.js 18+
- npm or pnpm

## Run Command

```bash
cd signal/frontend
npm install
npm run dev
```

---

## Directory Structure to Create

```
signal/frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── .env
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types.ts
    ├── hooks/
    │   └── useWebSocket.ts
    ├── store/
    │   └── reducer.ts
    └── components/
        ├── ModeIndicator.tsx
        ├── CallQueue.tsx
        ├── AgentCards.tsx
        ├── MapView.tsx
        ├── OverrideButton.tsx
        ├── HoldModal.tsx
        ├── BriefingPanel.tsx
        ├── AuditTrail.tsx
        └── DemoControls.tsx
```

---

## Shared Contract (backend owns these — do not change values)

```
Backend port:   8000
WebSocket URL:  ws://localhost:8000/ws
API base:       /api  (Vite proxies /api → http://localhost:8000)
Mode values:    ASSISTED | SURGE
Severity:       CRITICAL | URGENT | STANDARD
Agent names:    MONITOR | TRIAGE | RESOURCE | RELAY
Agent statuses: IDLE | RUNNING | COMPLETE | ERROR
```

WebSocket messages the frontend receives:
```typescript
{ type: "MODE_CHANGE",     payload: { mode: "SURGE" | "ASSISTED", timestamp: string } }
{ type: "CALL_ADDED",      payload: { id: string, severity: "CRITICAL"|"URGENT"|"STANDARD"|"PENDING", zone: string, vulnerable: boolean, incident_type: string } }
{ type: "AGENT_STATUS",    payload: { agent: "MONITOR"|"TRIAGE"|"RESOURCE"|"RELAY", status: "IDLE"|"RUNNING"|"COMPLETE"|"ERROR", last_action: string } }
{ type: "UNIT_DISPATCHED", payload: { call_id: string, unit_id: string, eta_minutes: number } }
{ type: "HOLD_REQUIRED",   payload: { call_id: string, unit_id: string, asset_type: string, hold_id: string } }
{ type: "HOLD_RESOLVED",   payload: { hold_id: string, action: "CONFIRMED" | "CANCELLED" } }
{ type: "BRIEFING_READY",  payload: { call_id: string, text: string, audio_url: string | null } }
{ type: "INCIDENT_REPORT", payload: { call_id: string, report: object } }
```

REST endpoints the frontend calls (via `/api` proxy):
```
POST /api/override
POST /api/confirm-hold   body: { hold_id: string }
POST /api/cancel-hold    body: { hold_id: string }
POST /api/demo/start
POST /api/demo/trigger-surge
POST /api/demo/reset
```

---

## Config Files

### `package.json`

```json
{
  "name": "signal-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "leaflet": "^1.9.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.12",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.5"
  }
}
```

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

### `tsconfig.json`

Standard React + Vite tsconfig. Include `"lib": ["ES2020", "DOM", "DOM.Iterable"]`, `"jsx": "react-jsx"`, `"strict": true`.

### `tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

### `postcss.config.js`

Standard Tailwind PostCSS config.

### `.env`

```
VITE_WS_URL=ws://localhost:8000/ws
```

### `index.html`

Standard Vite HTML template. Add Google Fonts link for Inter:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### `src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Leaflet CSS */
@import 'leaflet/dist/leaflet.css';

body {
  font-family: 'Inter', system-ui, sans-serif;
  background-color: #F8FAFC;
}
```

---

## Types (`src/types.ts`)

Define all shared TypeScript types:

```typescript
export type Mode = 'ASSISTED' | 'SURGE'
export type Severity = 'CRITICAL' | 'URGENT' | 'STANDARD' | 'PENDING'
export type AgentName = 'MONITOR' | 'TRIAGE' | 'RESOURCE' | 'RELAY'
export type AgentStatus = 'IDLE' | 'RUNNING' | 'COMPLETE' | 'ERROR'

export interface Call {
  id: string
  severity: Severity
  zone: string
  vulnerable: boolean
  incident_type: string
  unit_id?: string
  eta_minutes?: number
  briefing_text?: string
}

export interface AgentState {
  name: AgentName
  status: AgentStatus
  last_action: string
}

export interface HoldEvent {
  call_id: string
  unit_id: string
  asset_type: string
  hold_id: string
}

export interface AuditEntry {
  timestamp: string
  type: string
  summary: string
}

export interface AppState {
  mode: Mode
  calls: Call[]
  agents: Record<AgentName, AgentState>
  activeHold: HoldEvent | null
  lastBriefing: { text: string; audio_url: string | null } | null
  auditLog: AuditEntry[]
  connected: boolean
}

export type WsMessage =
  | { type: 'MODE_CHANGE'; payload: { mode: Mode; timestamp: string } }
  | { type: 'CALL_ADDED'; payload: { id: string; severity: Severity; zone: string; vulnerable: boolean; incident_type: string } }
  | { type: 'AGENT_STATUS'; payload: { agent: AgentName; status: AgentStatus; last_action: string } }
  | { type: 'UNIT_DISPATCHED'; payload: { call_id: string; unit_id: string; eta_minutes: number } }
  | { type: 'HOLD_REQUIRED'; payload: HoldEvent }
  | { type: 'HOLD_RESOLVED'; payload: { hold_id: string; action: 'CONFIRMED' | 'CANCELLED' } }
  | { type: 'BRIEFING_READY'; payload: { call_id: string; text: string; audio_url: string | null } }
  | { type: 'INCIDENT_REPORT'; payload: { call_id: string; report: object } }
```

---

## State Reducer (`src/store/reducer.ts`)

Pure reducer — no side effects. Handles every WebSocket message type.

```typescript
import { AppState, WsMessage, AgentName } from '../types'

const INITIAL_AGENTS = {
  MONITOR: { name: 'MONITOR' as AgentName, status: 'IDLE' as const, last_action: 'Watching call volume' },
  TRIAGE:  { name: 'TRIAGE'  as AgentName, status: 'IDLE' as const, last_action: 'Waiting for calls' },
  RESOURCE:{ name: 'RESOURCE' as AgentName, status: 'IDLE' as const, last_action: 'Ready to dispatch' },
  RELAY:   { name: 'RELAY'   as AgentName, status: 'IDLE' as const, last_action: 'Ready for briefings' },
}

export const initialState: AppState = {
  mode: 'ASSISTED',
  calls: [],
  agents: INITIAL_AGENTS,
  activeHold: null,
  lastBriefing: null,
  auditLog: [],
  connected: false,
}

export type Action =
  | { type: 'WS_MESSAGE'; message: WsMessage }
  | { type: 'WS_CONNECTED' }
  | { type: 'WS_DISCONNECTED' }

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'WS_CONNECTED':
      return { ...state, connected: true }
    case 'WS_DISCONNECTED':
      return { ...state, connected: false }
    case 'WS_MESSAGE':
      return handleMessage(state, action.message)
    default:
      return state
  }
}

function handleMessage(state: AppState, msg: WsMessage): AppState {
  const now = new Date().toISOString()
  switch (msg.type) {
    case 'MODE_CHANGE':
      return {
        ...state,
        mode: msg.payload.mode,
        auditLog: [{ timestamp: now, type: 'MODE_CHANGE', summary: `Mode changed to ${msg.payload.mode}` }, ...state.auditLog],
      }
    case 'CALL_ADDED': {
      const existing = state.calls.findIndex(c => c.id === msg.payload.id)
      const updatedCall = { ...msg.payload }
      const calls = existing >= 0
        ? state.calls.map((c, i) => i === existing ? { ...c, ...updatedCall } : c)
        : [updatedCall, ...state.calls]
      return {
        ...state,
        calls,
        auditLog: [{ timestamp: now, type: 'CALL_ADDED', summary: `Call ${msg.payload.id}: ${msg.payload.severity} — ${msg.payload.incident_type} in ${msg.payload.zone}` }, ...state.auditLog],
      }
    }
    case 'AGENT_STATUS':
      return {
        ...state,
        agents: {
          ...state.agents,
          [msg.payload.agent]: { name: msg.payload.agent, status: msg.payload.status, last_action: msg.payload.last_action },
        },
      }
    case 'UNIT_DISPATCHED': {
      const calls = state.calls.map(c =>
        c.id === msg.payload.call_id ? { ...c, unit_id: msg.payload.unit_id, eta_minutes: msg.payload.eta_minutes } : c
      )
      return {
        ...state,
        calls,
        auditLog: [{ timestamp: now, type: 'UNIT_DISPATCHED', summary: `Unit ${msg.payload.unit_id} → call ${msg.payload.call_id}, ETA ${msg.payload.eta_minutes}min` }, ...state.auditLog],
      }
    }
    case 'HOLD_REQUIRED':
      return {
        ...state,
        activeHold: msg.payload,
        auditLog: [{ timestamp: now, type: 'HOLD_REQUIRED', summary: `HOLD: ${msg.payload.asset_type} requested for call ${msg.payload.call_id}` }, ...state.auditLog],
      }
    case 'HOLD_RESOLVED':
      return {
        ...state,
        activeHold: state.activeHold?.hold_id === msg.payload.hold_id ? null : state.activeHold,
        auditLog: [{ timestamp: now, type: 'HOLD_RESOLVED', summary: `HOLD ${msg.payload.hold_id}: ${msg.payload.action}` }, ...state.auditLog],
      }
    case 'BRIEFING_READY':
      return {
        ...state,
        lastBriefing: { text: msg.payload.text, audio_url: msg.payload.audio_url },
        auditLog: [{ timestamp: now, type: 'BRIEFING_READY', summary: msg.payload.text }, ...state.auditLog],
      }
    case 'INCIDENT_REPORT':
      return {
        ...state,
        auditLog: [{ timestamp: now, type: 'INCIDENT_REPORT', summary: `Report filed for call ${msg.payload.call_id}` }, ...state.auditLog],
      }
    default:
      return state
  }
}
```

---

## WebSocket Hook (`src/hooks/useWebSocket.ts`)

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { WsMessage } from '../types'

export function useWebSocket(
  onMessage: (msg: WsMessage) => void,
  onConnect: () => void,
  onDisconnect: () => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    const url = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => onConnect()
    ws.onclose = () => {
      onDisconnect()
      reconnectTimeout.current = setTimeout(connect, 3000)
    }
    ws.onerror = () => ws.close()
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage
        onMessage(msg)
      } catch {
        // ignore malformed messages
      }
    }
  }, [onMessage, onConnect, onDisconnect])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimeout.current)
      wsRef.current?.close()
    }
  }, [connect])
}
```

---

## App Root (`src/App.tsx`)

Layout:
- Use `useReducer(reducer, initialState)`
- Wire up `useWebSocket` dispatching to reducer
- After `BRIEFING_READY` with `audio_url`: auto-play audio via `new Audio(url).play()`
- Layout: full viewport height, flex column
  1. `<ModeIndicator>` — fixed top banner
  2. Main content area — 3-column grid: left=CallQueue, center=MapView, right=(AgentCards + BriefingPanel)
  3. `<AuditTrail>` — collapsible panel at bottom
  4. `<DemoControls>` — fixed bottom dev bar
  5. `<HoldModal>` — conditionally rendered fullscreen overlay when `activeHold !== null`
  6. `<OverrideButton>` — floating fixed button, only in SURGE mode

---

## Components

### `ModeIndicator.tsx`

Props: `{ mode: Mode, connected: boolean }`

- Full-width banner, height ~48px
- ASSISTED: `bg-blue-700 text-white` — text: "ASSISTED MODE — AI is supporting. Dispatcher in control."
- SURGE: `bg-red-600 text-white` with a pulsing dot (animate-pulse) — text: "⚡ SURGE MODE ACTIVE — AI agents are triaging and routing"
- Right side: WebSocket connection indicator (green dot = connected, grey = disconnected)
- Transition smoothly between modes using CSS transition

### `CallQueue.tsx`

Props: `{ calls: Call[] }`

- White panel with `border border-slate-200 shadow-sm rounded-lg`
- Header: "Active Calls" with call count badge
- Scrollable list (max-height with overflow-y-auto)
- Each call row:
  - Triage badge pill (left):
    - CRITICAL: `bg-red-100 text-red-800 border border-red-200`
    - URGENT: `bg-amber-100 text-amber-800 border border-amber-200`
    - STANDARD: `bg-blue-100 text-blue-800 border border-blue-200`
    - PENDING: `bg-slate-100 text-slate-600`
  - Call ID (monospace, `text-xs text-slate-500`)
  - Incident type (capitalized)
  - Zone label
  - Vulnerable flag: if `vulnerable === true`, show a small warning icon (⚠️ or SVG) in amber
  - If dispatched: show unit + ETA in small text below
- Empty state: "No active calls" in slate-400

### `AgentCards.tsx`

Props: `{ agents: Record<AgentName, AgentState> }`

- 4 cards in a 2×2 grid (or 1×4 row if space allows)
- Each card: white panel, border, rounded-lg, padding
- Card header: agent name in uppercase, `font-semibold text-slate-900`
- Status dot (left of name):
  - IDLE: `bg-slate-300`
  - RUNNING: `bg-blue-500 animate-pulse`
  - COMPLETE: `bg-green-500`
  - ERROR: `bg-red-500`
- Last action text: `text-sm text-slate-500`, truncate at 2 lines
- Agent descriptions (subtitle):
  - MONITOR: "Watching call volume"
  - TRIAGE: "Classifying incidents"
  - RESOURCE: "Allocating units"
  - RELAY: "Generating briefings"

### `MapView.tsx`

Props: `{ calls: Call[], firePerimeter?: object }`

Uses Leaflet.js (not React Leaflet — use the vanilla leaflet library directly with `useEffect`).

Implementation:
1. In `useEffect`, create `L.map(ref.current, { center: [38.54, -121.74], zoom: 9 })`
2. Add OpenStreetMap tile layer: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
3. Fetch `/api/state` on mount to get fire perimeter. Render as GeoJSON layer with:
   - `style: { color: '#ea580c', weight: 2, fillColor: '#fed7aa', fillOpacity: 0.4 }`
   - Tooltip: "Park Fire 2024 — 429,083 acres"
4. Show response unit markers — fetch initial resource positions from `/api/state`. Use colored circle markers:
   - Available: green (`#16a34a`)
   - Unavailable: grey (`#94a3b8`)
5. Cleanup map on unmount to prevent Leaflet double-init errors

**Critical**: Leaflet requires the container div to have a fixed height. Set `style={{ height: '400px' }}` on the container.

### `OverrideButton.tsx`

Props: `{ mode: Mode, onOverride: () => void }`

- Only renders when `mode === 'SURGE'`
- Fixed position: `fixed bottom-20 right-6 z-50`
- Button: `bg-white border-2 border-red-500 text-red-600 font-semibold px-6 py-3 rounded-full shadow-lg hover:bg-red-50`
- Text: "⬛ Override — Return to Manual"
- On click: `POST /api/override` then call `onOverride()` callback
- Show confirmation toast or disable button briefly after click to prevent double-click

### `HoldModal.tsx`

Props: `{ hold: HoldEvent | null, onConfirm: (holdId: string) => void, onCancel: (holdId: string) => void }`

- Only renders when `hold !== null`
- Full-screen overlay: `fixed inset-0 bg-black/60 z-50 flex items-center justify-center`
- Modal box: `bg-white rounded-xl shadow-2xl max-w-md w-full p-8`
- Header: "⚠️ PROTOCOL HOLD — Dispatcher Confirmation Required" in `text-red-600 font-bold`
- Body:
  - Asset type (formatted): e.g., "Air Tanker deployment requested"
  - Call ID
  - "This action requires dispatcher approval before proceeding."
- Two buttons:
  - Confirm: `bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold` → `POST /api/confirm-hold` with `{ hold_id }`
  - Cancel: `bg-slate-100 text-slate-700 px-8 py-3 rounded-lg font-semibold` → `POST /api/cancel-hold` with `{ hold_id }`
- No close-on-backdrop-click — dispatcher must choose

### `BriefingPanel.tsx`

Props: `{ briefing: { text: string; audio_url: string | null } | null }`

- White panel, border, rounded-lg
- Header: "Latest Briefing" with a small speaker icon
- If `briefing === null`: "No briefings yet" in slate-400
- Briefing text in `font-medium text-slate-900`, larger font (~16px)
- If `audio_url !== null`: show a small "🔊 Audio available" badge in green
- Audio is auto-played by App.tsx — this panel just displays the text

### `AuditTrail.tsx`

Props: `{ entries: AuditEntry[] }`

- Collapsible section at the bottom of the page
- Toggle button: "Audit Trail (N entries)" — click to expand/collapse
- When expanded: scrollable list, max-height 200px
- Each entry:
  - Timestamp: monospace, `text-xs text-slate-400`
  - Type badge: small pill in slate-100
  - Summary text: `text-sm text-slate-700`
- Most recent entry first
- If empty: "No activity yet"

### `DemoControls.tsx`

Props: none (calls API directly)

- Fixed bottom bar: `fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center gap-4`
- Label: "Demo Controls" in `text-xs text-slate-400 font-semibold uppercase tracking-wide`
- Three buttons (compact, outlined style):
  - "Start Demo" → `POST /api/demo/start`
  - "Trigger Surge" → `POST /api/demo/trigger-surge` (red outline)
  - "Reset" → `POST /api/demo/reset` (slate outline)
- Show brief loading state on each button while request is in-flight
- If backend not available: buttons show "Backend offline" tooltip

---

## Visual Design Spec

```
Background:       #F8FAFC (slate-50)
Panel background: #FFFFFF
Panel border:     #E2E8F0 (slate-200)
Panel shadow:     shadow-sm only
Primary accent:   #1D4ED8 (blue-700)
SURGE banner:     #DC2626 (red-600)
Text primary:     #0F172A (slate-900)
Text secondary:   #64748B (slate-500)
Text muted:       #94A3B8 (slate-400)

CRITICAL badge:   bg-red-100  text-red-800  border-red-200
URGENT badge:     bg-amber-100 text-amber-800 border-amber-200
STANDARD badge:   bg-blue-100 text-blue-800 border-blue-200

No gradients. No heavy shadows. No dark backgrounds except mode indicator.
Font: Inter. Monospace only for IDs, timestamps, code values.
Border radius: rounded-lg (8px) for panels, rounded-full for badges.
```

---

## Important Notes

1. **No dark mode** — this is an emergency operations tool optimized for readability
2. **Leaflet fix**: import `leaflet/dist/leaflet.css` in `index.css`, not in the component. Otherwise marker icons break.
3. **WebSocket reconnects automatically** — the `useWebSocket` hook retries every 3s. Show connection status in ModeIndicator.
4. **Audio autoplay**: browsers block `audio.play()` without user interaction. Use a `try/catch` and show a "Click to play briefing" button as fallback if autoplay is blocked.
5. **HOLD modal blocks everything** — it sits above all content at `z-50`. This is intentional — the dispatcher must act on it before continuing.
6. **Calls list deduplication**: `CALL_ADDED` can fire twice for the same call ID (once with `PENDING`, once with real severity). The reducer handles this — the component just renders `state.calls`.
