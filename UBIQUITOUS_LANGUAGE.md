# Ubiquitous Language — SIGNAL

A human-in-the-loop emergency dispatch support system for wildfire surge events. The AI never speaks to callers — only to the dispatcher. This glossary formalizes domain terminology used across backend, frontend, and integration layers.

---

## System Modes

| Term        | Definition                                                                                   | Aliases to avoid         |
| ----------- | --------------------------------------------------------------------------------------------- | ------------------------ |
| **ASSISTED** | Normal operating mode in which the dispatcher is in full control and AI agents support       | Manual, normal, default  |
| **SURGE**    | High-volume crisis mode activated when incoming call rate exceeds the SURGE_THRESHOLD        | Overload, emergency mode |

---

## Actors

| Term            | Definition                                                                  | Aliases to avoid    |
| --------------- | --------------------------------------------------------------------------- | ------------------- |
| **Dispatcher**  | The human 911 operator; sole decision-maker; never bypassed by the AI       | User, operator      |
| **Caller**      | A person in crisis placing a 911 call; AI never communicates with them      | Requester, victim   |
| **AI Agent**    | One of four named intelligent systems assisting the dispatcher              | Agent module, bot   |

---

## AI Agents

Each agent performs a distinct role in the dispatch workflow.

| Term          | Definition                                                       | Aliases to avoid    |
| ------------- | ---------------------------------------------------------------- | ------------------- |
| **MONITOR**   | Watches incoming call volume; triggers SURGE mode when threshold | Call tracker        |
| **TRIAGE**    | Classifies incident severity (CRITICAL, URGENT, STANDARD)        | Classifier          |
| **RESOURCE**  | Allocates and dispatches response units; enforces HOLD protocol  | Dispatcher agent    |
| **RELAY**     | Generates dispatcher briefings via TTS or text; summarizes calls | Briefing generator  |

---

## Call & Incident

| Term              | Definition                                                                                        | Aliases to avoid       |
| ----------------- | ------------------------------------------------------------------------------------------------- | ---------------------- |
| **Call**          | An incoming 911 request from a caller; immutable identifier for the entire incident lifecycle    | Request, ticket       |
| **Incident**      | The emergency situation described by a call (e.g., wildfire, structure fire)                     | Event, emergency      |
| **Severity**      | The classified priority level of a call; one of CRITICAL, URGENT, STANDARD, or transient PENDING | Priority, classification |
| **CRITICAL**      | Most urgent severity; immediate life-safety threat                                              | High, red              |
| **URGENT**        | Severe but not immediate life-safety threat                                                      | Medium, orange         |
| **STANDARD**      | Lower urgency or routine incident                                                               | Low, green             |
| **PENDING**       | Transient severity state assigned immediately upon call intake; replaced by TRIAGE classification | Unclassified, unknown |
| **Incident Type** | The category of emergency (e.g., structure fire, vegetation fire, medical, hazmat)               | Event type, category  |
| **Zone**          | Geographic area or district where the incident is located                                        | Region, area, sector  |
| **Vulnerable**    | Boolean flag indicating the caller is a vulnerable individual (elderly, disabled, etc.)          | Special needs, at-risk |

---

## Response Units & Dispatch

| Term        | Definition                                                                         | Aliases to avoid      |
| ----------- | ---------------------------------------------------------------------------------- | --------------------- |
| **Unit**    | A dispatched response resource (fire truck, tanker, rescue team, etc.)             | Vehicle, resource     |
| **Unit ID** | Unique identifier for a response unit                                              | Vehicle ID, truck ID  |
| **ETA**     | Estimated time of arrival in minutes for a dispatched unit to reach the incident  | Arrival time, time to scene |
| **Dispatch** | The act of assigning and sending a unit to a call                                 | Send, assign          |

---

## Protocol HOLD

The HOLD protocol prevents dangerous deployments without explicit human approval.

| Term             | Definition                                                                    | Aliases to avoid       |
| ---------------- | ----------------------------------------------------------------------------- | ---------------------- |
| **HOLD**         | A blocking state requiring dispatcher confirmation before deploying a heavy asset | Block, gate           |
| **Hold Event**   | A HOLD_REQUIRED message requesting dispatcher decision on a deployment       | Hold request           |
| **Heavy Asset**  | Specialized or high-risk response unit (air_tanker, heavy_rescue, hazmat)    | Restricted unit       |
| **Confirm**      | Dispatcher action approving a HOLD; permits unit dispatch                     | Approve               |
| **Cancel**       | Dispatcher action rejecting a HOLD; prevents unit dispatch                    | Reject, deny          |

---

## Briefing

| Term              | Definition                                                                  | Aliases to avoid       |
| ----------------- | --------------------------------------------------------------------------- | ---------------------- |
| **Briefing**      | A summary of a call generated by RELAY agent for the dispatcher              | Summary, overview      |
| **Briefing Text** | Human-readable text form of a briefing                                       | Text summary           |
| **Audio Briefing** | Briefing rendered as spoken audio via ElevenLabs TTS; optional, text fallback | Voice briefing, TTS   |

---

## Audit & Observability

| Term              | Definition                                                                              | Aliases to avoid       |
| ----------------- | --------------------------------------------------------------------------------------- | ---------------------- |
| **Audit Entry**   | A timestamped record of a system event (mode change, call added, agent status, hold, etc.) | Log entry, event log |
| **Audit Log**     | Chronologically ordered list of all audit entries; immutable append-only log             | System log             |
| **Override**      | Dispatcher action to forcibly return from SURGE to ASSISTED mode                        | Cancel surge, reset    |

---

## Technical Terms with Domain Meaning

| Term                 | Definition                                                                                                           | Aliases to avoid       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Agent Status**     | Current state of an AI agent: IDLE (ready), RUNNING (active), COMPLETE (finished), or ERROR (failed)               | State, condition       |
| **WebSocket Message** | Real-time event pushed from backend to frontend via `/ws` connection; carries call, agent, hold, mode, or briefing data | Event, frame          |
| **Mode Change**      | A WebSocket event indicating transition between ASSISTED and SURGE modes                                            | Mode switch            |
| **SURGE_THRESHOLD**  | Environment variable controlling call rate (calls/min) at which SURGE mode activates; default 10                   | Threshold value       |

---

## Relationships

- A **Call** is placed by a **Caller** and received by a **Dispatcher**.
- A **Call** has exactly one **Severity** (CRITICAL, URGENT, STANDARD, or PENDING).
- **TRIAGE** replaces PENDING severity with a final classification (CRITICAL, URGENT, or STANDARD).
- **RESOURCE** may dispatch a **Unit** to a **Call**, generating an ETA.
- A **Unit** deployment may trigger a **HOLD** if it is a **Heavy Asset**.
- A **Dispatcher** must **Confirm** or **Cancel** a **HOLD** before the **Unit** can be dispatched.
- **RELAY** generates a **Briefing** (text or audio) for each **Call**, viewed by the **Dispatcher**.
- **MONITOR** triggers transition from **ASSISTED** to **SURGE** when call volume exceeds **SURGE_THRESHOLD**.
- **Dispatcher** can issue an **Override** to return from **SURGE** to **ASSISTED**.
- Every action is recorded as an **Audit Entry** in the immutable **Audit Log**.

---

## Example Dialogue

> **Frontend Dev:** "When a caller places a call, what severity do we show them?"
>
> **Domain Expert:** "We show nothing to the caller. The dispatcher receives the **Call** immediately with severity PENDING. TRIAGE classifies it within seconds to CRITICAL, URGENT, or STANDARD."
>
> **Frontend Dev:** "So if a **Call** comes in during **SURGE** mode with a **Heavy Asset** request, what happens?"
>
> **Domain Expert:** "RESOURCE detects the **Heavy Asset** type and emits a **HOLD_REQUIRED** message. The dispatcher sees the **Hold** modal with the **Call** details and must explicitly **Confirm** or **Cancel** before dispatch. If they **Confirm**, the **Unit** is dispatched with an ETA. If they **Cancel**, the **Unit** never moves."
>
> **Frontend Dev:** "And if the dispatcher wants to exit **SURGE** mode while there are active **Holds**?"
>
> **Domain Expert:** "They issue an **Override**. The system returns to **ASSISTED** mode immediately. Any pending **Holds** remain until the dispatcher resolves them — the mode change doesn't auto-cancel deployments. Every action, including the **Override**, is logged as an **Audit Entry** with a timestamp."
>
> **Frontend Dev:** "Got it. So the **Dispatcher** is always the bottleneck for critical decisions, and the **Audit Log** records every turn."
>
> **Domain Expert:** "Exactly. The **AI Agents** advise, but the **Dispatcher** decides. That's the core safety constraint: the AI never speaks to the **Caller**, only to the **Dispatcher**."

---

## Flagged Ambiguities

**None identified.** The terminology is internally consistent across codebase, PRD, and team specification. All synonyms (e.g., "caller" vs. "requester") have been consolidated into canonical terms. The PENDING severity state is correctly recognized as transient, not a final classification.

---

## Notes for Implementation

- **Enums** (Mode, Severity, AgentName, AgentStatus) are shared contracts across backend, frontend, and integration layers. Changes require all three to align.
- **WebSocket messages** are the source-of-truth for inter-service communication; never deviate from the canonical schema.
- **Heavy asset types** (air_tanker, heavy_rescue, hazmat) trigger HOLD protocol; new types must be added to the enum and the HOLD logic.
- **Dispatcher** is never bypassed by AI. Every HOLD, override, or critical decision requires human confirmation.
- **Audit Log** is append-only and immutable; timestamps use ISO8601 format.
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
| **Briefing** | A concise spoken summary generated by RELAY containing incident ID, severity, zone, incident type, assigned unit, and ETA. Follows template: "Incident [ID]. [Severity]. [Zone]. [Incident type]. Unit [unit_id] dispatched. ETA [N] minutes." | Summary, incident summary, dispatch brief |
| **Audio briefing** | A TTS-rendered briefing via ElevenLabs; falls back to text-only briefing if the audio key is absent. | Voice briefing, spoken briefing |

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
| **Sliding window** | A 60-second rolling window of call timestamps used by MONITOR to compute the current call rate (calls/minute) for surge detection. | Rate window, 60-second window, moving window |

## Flagged Ambiguities

### 1. "Resource" vs. "Unit"
- **Problem**: "Resource" is used both as a module name (`state.resources`) and as a synonym for "Unit" in agent code.
- **Canonical term**: **Unit**
- **Recommendation**: Standardize on "Unit" in domain language. If the `state.resources` module name must persist in code, treat it as a technical implementation detail; the domain concept is always "Unit."

### 2. "Incident" lifecycle ambiguity
- **Problem**: "Incident" is used both for a call-in-progress (after triage) and for the completed log entry (after briefing and dispatch).
- **Canonical distinction**:
  - **Call** → initial entry; awaiting triage
  - **Incident** → call after triage, resource selection, and briefing generation; logged to incident_log
- **Recommendation**: In conversation, say "a Call has become an Incident once RELAY generates a briefing."

### 3. "Override" — action vs. field
- **Problem**: "Override" refers both to the dispatcher action (POST /override endpoint) and to a boolean field in the audit record (`dispatcher_override: bool`).
- **Canonical terms**:
  - **Override** (noun/verb) → the dispatcher action or the event
  - **dispatcher_override** → the boolean field in the incident record
- **Recommendation**: When discussing the action, say "the dispatcher issued an override." When discussing the record, say "the incident has `dispatcher_override: true`."

### 4. "Report" — event vs. object
- **Problem**: "Report" refers both to the INCIDENT_REPORT WebSocket event and to the report object contained within the event payload.
- **Canonical terms**:
  - **INCIDENT_REPORT** → the WebSocket event
  - **Report** or **incident report object** → the payload data structure
- **Recommendation**: Prefer "INCIDENT_REPORT event" and "incident report payload" to avoid confusion.

## Example Dialogue

> **Dev**: "When MONITOR detects that the call rate exceeds the surge threshold, does SURGE mode activate immediately?"
>
> **Domain Expert**: "Yes. MONITOR uses a 60-second sliding window to compute the call rate. Once calls/minute crosses the threshold, the system transitions to SURGE mode and sets surge_started_at. From that point, TRIAGE, RESOURCE, and RELAY operate automatically without dispatcher intervention on each call."
>
> **Dev**: "And if the dispatcher wants to take back control, they issue an Override?"
>
> **Domain Expert**: "Exactly. An Override forces the system back to ASSISTED mode. That action is logged in the incident record as dispatcher_override: true. But note — an Override doesn't undo the dispatch; it prevents future automated decisions."
>
> **Dev**: "Got it. Now, when RESOURCE selects a heavy asset like an air_tanker, what happens?"
>
> **Domain Expert**: "RESOURCE doesn't dispatch it directly. Instead, it broadcasts a HOLD_REQUIRED event with a unique hold_id. The dispatcher then sees the hold in the briefing and must either confirm it (CONFIRMED) or cancel it (CANCELLED). Only after CONFIRMED does the air_tanker get dispatched."
>
> **Dev**: "So the dispatcher always has the final say on rare resources."
>
> **Domain Expert**: "Correct. Standard assets like engines and personnel are dispatched immediately. But anything involving heavy_rescue, hazmat, or air_tanker goes through HOLD. That's our human-in-the-loop safeguard for expensive and specialized resources."

## Key Relationships

- A **Call** is created when a caller reports an emergency; it has an initial reported_type and description.
- TRIAGE converts a **Call** into a classified **Incident** by assigning severity and incident_type.
- RESOURCE selects units for the **Incident**; if a **heavy asset** is selected, a **HOLD** is created.
- RELAY generates a **Briefing** once all units are selected; the briefing is delivered to the **Dispatcher**.
- The **Dispatcher** confirms or cancels any **HOLD** and may issue an **Override** to return to ASSISTED mode.
- Upon **Briefing** delivery and **HOLD** resolution, the **Incident** is logged to the **incident_log**.
- A **Zone** has a **vulnerability score**; calls in vulnerable zones are flagged as **vulnerable** and prioritized.
- In **SURGE** mode, AI agents operate autonomously until a **Briefing** is ready; in **ASSISTED** mode, the **Dispatcher** controls all decisions.
