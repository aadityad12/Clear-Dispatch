#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="http://localhost:8000"
WS_URL="ws://localhost:8000/ws"
TIMEOUT=45

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "    ${GREEN}PASS${NC} $1"; }
fail() { echo -e "    ${RED}FAIL${NC} $1"; exit 1; }
info() { echo -e "    ${YELLOW}INFO${NC} $1"; }

echo "=== SIGNAL Smoke Test ==="
echo ""

# 1. Wait for backend
echo "[1/6] Waiting for backend at $BACKEND_URL..."
for i in $(seq 1 20); do
    if curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
        HEALTH=$(curl -sf "$BACKEND_URL/health")
        pass "Backend ready — $HEALTH"
        break
    fi
    if [ "$i" -eq 20 ]; then
        fail "Backend not responding after 20 attempts"
    fi
    sleep 1
done

# 2. Reset state
echo ""
echo "[2/6] Resetting state..."
RESET=$(curl -sf -X POST "$BACKEND_URL/demo/reset")
if echo "$RESET" | grep -q '"ok":true'; then
    pass "Reset OK"
else
    fail "Reset returned unexpected response: $RESET"
fi

# Verify health shows ASSISTED after reset
HEALTH=$(curl -sf "$BACKEND_URL/health")
if echo "$HEALTH" | grep -q '"mode":"ASSISTED"'; then
    pass "Mode is ASSISTED after reset"
else
    fail "Mode not ASSISTED after reset — got: $HEALTH"
fi

# 3. Post a single test call and capture call_id
echo ""
echo "[3/6] Posting test call..."
RESPONSE=$(curl -sf -X POST "$BACKEND_URL/call" \
    -H "Content-Type: application/json" \
    -d '{
        "caller_id": "SMOKE-001",
        "lat": 38.5449,
        "lon": -121.7405,
        "zone": "YL-03",
        "reported_type": "fire",
        "description": "Smoke test call — automated verification"
    }')
CALL_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['call_id'])" 2>/dev/null || true)
if [ -z "$CALL_ID" ]; then
    fail "No call_id in response: $RESPONSE"
fi
pass "Call posted — ID: $CALL_ID"

# 4. Wait for CALL_ADDED + BRIEFING_READY on WebSocket
echo ""
echo "[4/6] Waiting for CALL_ADDED and BRIEFING_READY on WebSocket (timeout: ${TIMEOUT}s)..."
WS_RESULT=$(python3 - <<PYEOF
import asyncio, json, sys

async def wait_for_messages():
    try:
        import websockets
    except ImportError:
        print("MISSING_WEBSOCKETS")
        return 2

    try:
        async with websockets.connect("$WS_URL") as ws:
            saw_call_added = False
            saw_briefing = False
            try:
                async with asyncio.timeout($TIMEOUT):
                    async for raw in ws:
                        msg = json.loads(raw)
                        t = msg.get("type")
                        p = msg.get("payload", {})
                        if t == "CALL_ADDED" and p.get("id") == "$CALL_ID":
                            saw_call_added = True
                            print(f"CALL_ADDED severity={p.get('severity')}")
                        if t == "BRIEFING_READY" and p.get("call_id") == "$CALL_ID":
                            saw_briefing = True
                            print(f"BRIEFING_READY text={p.get('text','')[:80]}")
                        if saw_call_added and saw_briefing:
                            return 0
            except asyncio.TimeoutError:
                missing = []
                if not saw_call_added:
                    missing.append("CALL_ADDED")
                if not saw_briefing:
                    missing.append("BRIEFING_READY")
                print(f"TIMEOUT missing={','.join(missing)}")
                return 1
    except Exception as e:
        print(f"WS_ERROR {e}")
        return 1

sys.exit(asyncio.run(wait_for_messages()))
PYEOF
) || WS_EXIT=$?

if echo "$WS_RESULT" | grep -q "MISSING_WEBSOCKETS"; then
    info "websockets package not installed — skipping WS check"
    info "Install with: pip install websockets"
elif echo "$WS_RESULT" | grep -q "TIMEOUT"; then
    fail "WebSocket timeout — $WS_RESULT"
elif echo "$WS_RESULT" | grep -q "WS_ERROR"; then
    fail "WebSocket error — $WS_RESULT"
else
    while IFS= read -r line; do
        [ -n "$line" ] && pass "$line"
    done <<< "$WS_RESULT"
fi

# 5. Verify demo endpoints
echo ""
echo "[5/6] Verifying demo endpoints..."

curl -sf -X POST "$BACKEND_URL/demo/reset" > /dev/null
pass "POST /demo/reset OK"

START=$(curl -sf -X POST "$BACKEND_URL/demo/start")
if echo "$START" | grep -q '"ok":true'; then
    pass "POST /demo/start OK"
else
    fail "POST /demo/start failed: $START"
fi

SURGE=$(curl -sf -X POST "$BACKEND_URL/demo/trigger-surge")
if echo "$SURGE" | grep -q '"ok":true'; then
    pass "POST /demo/trigger-surge OK"
else
    fail "POST /demo/trigger-surge failed: $SURGE"
fi

# 6. Verify calls were injected
echo ""
echo "[6/6] Verifying call queue..."
sleep 2  # give the pipeline a moment to register calls
CALLS=$(curl -sf "$BACKEND_URL/calls")
CALL_COUNT=$(echo "$CALLS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
if [ "$CALL_COUNT" -ge 4 ]; then
    pass "Call queue has $CALL_COUNT calls (expected ≥4 after demo start + surge)"
else
    fail "Call queue has only $CALL_COUNT calls — expected ≥4"
fi

echo ""
echo -e "${GREEN}=== Smoke test PASSED ===${NC}"
exit 0
