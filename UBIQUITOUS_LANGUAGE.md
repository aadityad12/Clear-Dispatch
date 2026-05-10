# Ubiquitous Language — SIGNAL

A human-in-the-loop emergency dispatch support system for wildfire surge events. The AI never speaks to callers — only to the dispatcher. This glossary formalizes domain terminology used across backend, frontend, and integration layers.

---

## Operating Modes

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **ASSISTED** | Operating mode in which the dispatcher makes all call classification, resource selection, and dispatch decisions; AI provides decision support only. | Standard mode, manual mode |
| **SURGE** | Operating mode in which AI agents (TRIAGE, RESOURCE, RELAY) automatically handle call classification, resource selection, and briefing generation. | Auto mode, autonomous mode |
| **Surge threshold** | The call rate (calls/minute) that triggers automatic transition from ASSISTED to SURGE mode. | Threshold, trigger point |
| **Surge started_at** | Timestamp marking when the system transitioned to SURGE mode. | Surge timestamp |

## Actors

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Dispatcher** | The human 911 operator; always the human interface between callers and the emergency response system. All final dispatch and override decisions are the dispatcher's responsibility. | Operator, responder, user |
| **Caller** | The person in crisis who initiates an emergency call. The AI agents never communicate directly with callers. | Person, victim, resident |
| **EOC Supervisor** | Emergency Operations Center supervisor; oversees incident command and resource allocation strategy. | Supervisor, commander, incident commander |

## AI Agents

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **MONITOR** | Agent responsible for tracking call volume, computing surge rate via a 60-second sliding window, and controlling mode transitions. | Monitor service, rate monitor |
| **TRIAGE** | Agent that classifies incoming calls by severity (CRITICAL/URGENT/STANDARD/PENDING) and incident type (fire/evacuation/medical/structure/other). | Classifier, intake agent |
| **RESOURCE** | Agent that selects and dispatches appropriate units based on incident severity, type, and zone vulnerability; enforces HOLD protocol for heavy assets. | Dispatcher agent, allocation agent |
| **RELAY** | Agent that generates dispatcher briefings and optionally produces voice audio via text-to-speech. | Briefing agent, voice agent |

## Agent Lifecycle

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **IDLE** | Agent state indicating the agent is not currently processing a call or request. | Waiting, inactive, standby |
| **RUNNING** | Agent state indicating active processing of a call or request. | Processing, active, in-progress |
| **COMPLETE** | Agent state indicating successful completion of a task (call triaged, resource selected, briefing generated). | Finished, done, success |
| **ERROR** | Agent state indicating a failure during processing. | Failed, exception |

## Calls and Incidents

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Call** | An incoming emergency call injected into the system; has caller_id, lat/lon, zone, reported_type, and description. A call is the initial entry point; not yet classified or resourced. | Request, intake, emergency call |
| **Incident** | A call that has been triaged and routed; a record in the incident_log after RELAY has generated a briefing and RESOURCE has dispatched units. Represents the complete lifecycle of a single emergency event from arrival to dispatch. | Case, event, alert |
| **Call queue** | The list of active and pending calls awaiting triage and dispatch. | Queue, intake queue, active calls |
| **Incident log** | The audit trail of completed incidents; created by RELAY after briefing generation; includes all dispatch decisions and overrides. | History, audit log, record log |
| **Severity** | Classification of call urgency: **CRITICAL** (immediate life threat), **URGENT** (significant risk), **STANDARD** (routine), or **PENDING** (awaiting triage). | Priority level, urgency |
| **Incident type** | The category of emergency: **fire**, **evacuation**, **medical**, **structure**, or **other**. | Call type, emergency type |
| **Zone** | A geographic area identifier used for resource allocation and vulnerability tracking (YL-01 through YL-08). | District, sector, geographic zone |
| **Vulnerability score** | A 0.0–1.0 quantitative score per zone indicating the proportion of at-risk population (elderly, disabled, non-English speakers). Zones with scores > 0.6 are flagged as **vulnerable**. | Risk score, at-risk ratio |
| **Vulnerable** | Boolean flag on a call (true/false) indicating whether the zone has a high vulnerability score (> 0.6) or the description mentions at-risk populations. When true, resource dispatch prioritizes rapid response. | At-risk, high-vulnerability |

## Resources and Dispatch

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Unit** | A response resource type available for dispatch: **engine**, **personnel**, **air_tanker**, **heavy_rescue**, or **hazmat**. Canonical term for all response resources. | Resource, asset, vehicle |
| **Dispatch** | The act of assigning a unit to a call; results in a UNIT_DISPATCHED WebSocket broadcast and a unit record in the incident log. | Assignment, allocation, send |
| **ETA** | Estimated time of arrival in minutes; calculated as `distance_km / 80 * 60`. Communicated to dispatcher in briefing. | Arrival time, time to arrival |
| **Heavy asset** | A unit type (air_tanker, heavy_rescue, hazmat) that requires mandatory dispatcher confirmation before dispatch; subject to HOLD protocol. | Specialized unit, equipment requiring approval |
| **Standard asset** | A unit type (engine, personnel) dispatched immediately without confirmation; never subject to HOLD. | Regular unit, standard equipment |

## HOLD Protocol

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **HOLD** | A mandatory pause in dispatch when a heavy asset is needed; the dispatcher must confirm or cancel the dispatch before the unit is actually sent. Ensures human oversight of rare/expensive resources. | Hold state, dispatch pause, confirmation pause |
| **hold_id** | Unique identifier for a hold record; used to track and resolve a specific hold. | Hold token, confirmation ID |
| **HOLD_REQUIRED** | WebSocket event signaling that a heavy asset dispatch is pending and awaiting dispatcher confirmation or cancellation. | Hold notification, confirmation needed |
| **HOLD_RESOLVED** | WebSocket event broadcast when a hold is confirmed or cancelled by the dispatcher. | Hold completed, confirmation resolved |
| **CONFIRMED** | Resolution state indicating the dispatcher approved the heavy asset dispatch; the unit is now sent. | Approved, accepted |
| **CANCELLED** | Resolution state indicating the dispatcher rejected the heavy asset dispatch; the unit is not sent and incident routing continues with other units. | Rejected, denied, declined |

## Dispatcher Actions and Briefings

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Override** | Dispatcher action to force return to ASSISTED mode from SURGE; logged as `dispatcher_override: true` in the incident record. Used when dispatcher judges that the incident requires manual control. | Manual override, mode override, force manual |
| **Briefing** | A single summary record generated by RELAY for a call, containing call_id, text content, audio_url (ElevenLabs MP3 or null), and ISO8601 timestamp of receipt. | Summary, dispatch brief |
| **Audio briefing** | A TTS-rendered briefing via ElevenLabs; `audio_url` field contains MP3 URL, or null if TTS was unavailable. | Voice briefing, spoken briefing |
| **Briefing history** | The ordered array of all past **Briefings** for the current session (newest first), stored in frontend React state. Reset on page reload. | Briefing list, briefing array, past briefings |

## System Events

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **MODE_CHANGE** | WebSocket event broadcast when the system transitions between ASSISTED and SURGE modes. | Mode transition, mode update |
| **CALL_ADDED** | WebSocket event broadcast when a new call is added to the call queue. | Call intake, new call notification |
| **AGENT_STATUS** | WebSocket event broadcast when an agent's state changes (IDLE, RUNNING, COMPLETE, ERROR). | Agent update, status update |
| **UNIT_DISPATCHED** | WebSocket event broadcast when a unit is assigned to and dispatched for an incident. | Dispatch event, unit assignment |
| **HOLD_REQUIRED** | WebSocket event signaling a hold is pending for dispatcher confirmation. | See HOLD Protocol section. |
| **HOLD_RESOLVED** | WebSocket event when a hold is confirmed or cancelled. | See HOLD Protocol section. |
| **BRIEFING_READY** | WebSocket event broadcast when RELAY has generated a briefing and it is ready for dispatcher delivery. | Briefing generated, briefing available |
| **INCIDENT_REPORT** | WebSocket event containing the final incident record after all dispatch and logging is complete. | Report event, final report |

## System State and Background Tasks

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **System state** | In-memory singleton containing: current mode (ASSISTED/SURGE), surge_threshold, surge_started_at timestamp, and call_timestamps for rate computation. | Global state, system configuration |
| **Simulator** | Background task that generates synthetic calls at a configurable Poisson rate (λ calls/minute) for testing and load simulation. | Call generator, synthetic call task, test simulator |
| **Simulator lambda** | The Poisson arrival rate (calls/minute): λ=0.1 (demo-quiet mode), λ=2.0 (normal background), λ=15.0 (surge demonstration). After **Demo reset**, lambda is set to 0.1 so background simulator noise does not interfere with the scripted demo calls. Normal background operation uses λ=2.0. | Arrival rate, lambda parameter, call rate |
| **Sliding window** | A 60-second rolling window of call timestamps used by MONITOR to compute the current call rate (calls/minute) for surge detection. | Rate window, 60-second window, moving window |
| **Demo lifecycle** | The scripted judge demo sequence: **Reset** → **Start Demo** → **Trigger Surge** → confirm HOLD → Override → Audit Trail. Each step must be run in order; Reset re-marks all resources available and sets simulator to demo-quiet mode. | Demo flow, demo steps |

## State Lifecycle

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Session state** | Frontend-only in-memory state stored in React component state: **Call queue**, **Briefing history**, UI state, mode indicator. Volatile; reset to empty on page reload. | Frontend state, UI state, transient state |
| **Persistent state** | Backend-stored data: **incident_log** (completed incidents), audit trail, system configuration. Survives reconnects and outlives sessions. | Backend state, durable state, database state |
| **Re-hydration** | Process of a client reconnecting after network loss or page reload; client calls `GET /state` to fetch current system state (mode, call queue, recent incidents) and re-initializes **session state**. | State sync, reconnect sync, state fetch |
| **Incident log** | Append-only persistent backend log of completed incidents; each entry includes call, severity, incident type, assigned units, hold confirmations, briefing, and audit metadata. Created after RELAY generates a **Briefing** and RESOURCE resolves all **Holds**. | Incident record, history log, audit log |

## Demo Mode

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Demo reset** | Action that clears all system state (call queue, incident log, briefing history) and sets **simulator lambda** to 0.1 to enter demo-quiet mode. Logged: "Demo reset — all state cleared". | Reset demo, demo clear |
| **Demo start** | Action that injects 2 synthetic normal calls into the call queue to demonstrate triage and dispatch. Logged: "Demo started — 2 normal calls injected". | Start demo, demo begin |
| **Demo surge trigger** | Action that injects 4 synthetic calls (including a **heavy asset** request) to demonstrate SURGE mode and the HOLD protocol. Logged: "Demo surge triggered — 4 calls injected, heavy asset included". | Trigger surge, surge demo |
| **Demo-quiet mode** | State of the simulator after **Demo reset**, with **simulator lambda** = 0.1, producing negligible background calls (~1 per 10 minutes) so judge focus is on injected demo calls. | Quiet simulator, demo pause, background-quiet |

---

## Flagged Ambiguities

### 1. "Briefing history" vs. "Incident log"
- **Problem**: Both record past briefing and incident data, but they exist in different layers and have different lifecycles.
- **Canonical distinction**:
  - **Briefing history** → frontend session state (React component state); array of all briefings received in the current session; volatile; reset on page reload
  - **Incident log** → backend persistent state (database); append-only record of completed incidents with full audit metadata; survives reconnects
- **Recommendation**: When discussing dispatcher-facing briefings in the current session, say "the **Briefing history** shows all past briefings." When discussing the authoritative audit trail, say "the **incident log** records completed incidents." Session state is ephemeral; persistent state is the source of truth.

### 2. "Resource" vs. "Unit"
- **Problem**: "Resource" is used both as a module name (`state.resources`) and as a synonym for "Unit" in agent code.
- **Canonical term**: **Unit**
- **Recommendation**: Standardize on "Unit" in domain language. If the `state.resources` module name must persist in code, treat it as a technical implementation detail; the domain concept is always "Unit."

### 3. "Incident" lifecycle ambiguity
- **Problem**: "Incident" is used both for a call-in-progress (after triage) and for the completed log entry (after briefing and dispatch).
- **Canonical distinction**:
  - **Call** → initial entry; awaiting triage
  - **Incident** → call after triage, resource selection, and briefing generation; logged to incident_log
- **Recommendation**: In conversation, say "a Call has become an Incident once RELAY generates a briefing."

### 4. "Override" — action vs. field
- **Problem**: "Override" refers both to the dispatcher action (POST /override endpoint) and to a boolean field in the audit record (`dispatcher_override: bool`).
- **Canonical terms**:
  - **Override** (noun/verb) → the dispatcher action or the event
  - **dispatcher_override** → the boolean field in the incident record
- **Recommendation**: When discussing the action, say "the dispatcher issued an override." When discussing the record, say "the incident has `dispatcher_override: true`."

### 5. "Report" — event vs. object
- **Problem**: "Report" refers both to the INCIDENT_REPORT WebSocket event and to the report object contained within the event payload.
- **Canonical terms**:
  - **INCIDENT_REPORT** → the WebSocket event
  - **Report** or **incident report object** → the payload data structure
- **Recommendation**: Prefer "INCIDENT_REPORT event" and "incident report payload" to avoid confusion.

---

## Example Dialogue

> **Frontend Dev**: "During a judge demo, if the briefing history accumulates and then the judge reloads the page, what happens to the briefings?"
>
> **Domain Expert**: "The **Briefing history** is frontend session state — it's stored only in React component state. When the page reloads, the **Briefing history** is lost. But the **incident log** on the backend persists. When the client reconnects and calls `GET /state`, it gets back the system mode and recent incidents, but the **Briefing history** starts fresh."
>
> **Frontend Dev**: "So the judge would lose the visual timeline of briefings they saw during the demo?"
>
> **Domain Expert**: "Yes, unless you cache the **Briefing history** to localStorage or send it to the backend. The distinction is: volatile **session state** (briefing history) lives only in memory, while **persistent state** (incident log) survives across reconnects."
>
> **Frontend Dev**: "Now, if we're running a judge demo and we call Demo reset, what happens to the state?"
>
> **Domain Expert**: "**Demo reset** clears all state — call queue, incident log, briefing history — and sets **simulator lambda** to 0.1 to enter **demo-quiet mode**. Then **Demo start** injects 2 normal calls. We log each step so the judge audit trail shows the demo sequence. When you trigger **Demo surge**, we inject 4 calls including a heavy asset; that forces RESOURCE to emit a HOLD, demonstrating the **HOLD** protocol."
>
> **Frontend Dev**: "And the simulator stays quiet during that sequence?"
>
> **Domain Expert**: "Right. **Demo-quiet mode** keeps **simulator lambda** at 0.1, so background noise is negligible — only about 1 call every 10 minutes. The judge focus is on the injected demo calls, not random background traffic."
>
> **Frontend Dev**: "Got it. So **Demo lifecycle** is the three-step reset-start-surge sequence, and each step is both a UI action and a backend state change?"
>
> **Domain Expert**: "Exactly. Each step is logged ('Demo reset — all state cleared', etc.), and it affects both the simulator and the system state. The judge demo is deterministic and fully auditable."

---

## Key Relationships

- A **Call** is created when a caller reports an emergency; it has an initial reported_type and description.
- TRIAGE converts a **Call** into a classified **Incident** by assigning severity and incident_type.
- RESOURCE selects units for the **Incident**; if a **heavy asset** is selected, a **HOLD** is created.
- RELAY generates a **Briefing** once all units are selected; the briefing is delivered to the **Dispatcher**.
- The **Dispatcher** confirms or cancels any **HOLD** and may issue an **Override** to return to ASSISTED mode.
- Upon **Briefing** delivery and **HOLD** resolution, the **Incident** is logged to the **incident_log**.
- A **Zone** has a **vulnerability score**; calls in vulnerable zones are flagged as **vulnerable** and prioritized.
- In **SURGE** mode, AI agents operate autonomously until a **Briefing** is ready; in **ASSISTED** mode, the **Dispatcher** controls all decisions.
