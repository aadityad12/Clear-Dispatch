import logging
import os
import re
from collections import deque
from datetime import datetime, timezone

_REDACTED = "***REDACTED***"

# Patterns that should never appear in logs
_SENSITIVE_PATTERNS = [
    re.compile(r"sk-ant-[A-Za-z0-9_\-]{10,}", re.IGNORECASE),
    re.compile(r"xi-api-key[\"']?\s*[:=]\s*[\"']?[A-Za-z0-9_\-]{20,}", re.IGNORECASE),
    re.compile(r"Bearer\s+[A-Za-z0-9_\-\.]{20,}", re.IGNORECASE),
]


def _sanitize(text: str) -> str:
    for pattern in _SENSITIVE_PATTERNS:
        text = pattern.sub(_REDACTED, text)

    # Also redact actual runtime env var values if they look key-like
    for var in ("ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY"):
        val = os.getenv(var, "")
        if val and len(val) >= 16:
            text = text.replace(val, _REDACTED)

    return text


class _InMemoryHandler(logging.Handler):
    def __init__(self, maxlen: int = 500):
        super().__init__()
        self._buffer: deque[dict] = deque(maxlen=maxlen)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = _sanitize(self.format(record))
            self._buffer.append({
                "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": msg,
            })
        except Exception:
            pass

    def get_entries(self, level: str | None = None, limit: int = 200) -> list[dict]:
        entries = list(self._buffer)
        if level:
            entries = [e for e in entries if e["level"] == level.upper()]
        return entries[-limit:]


_handler = _InMemoryHandler(maxlen=500)
_handler.setFormatter(logging.Formatter("%(message)s"))

# Attach to root so all loggers in the app feed into this buffer
_root = logging.getLogger()
_root.addHandler(_handler)
_root.setLevel(logging.DEBUG)

# Silence noisy third-party loggers
for _noisy in ("httpx", "httpcore", "uvicorn.access", "anthropic"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)


def get_log_entries(level: str | None = None, limit: int = 200) -> list[dict]:
    return _handler.get_entries(level=level, limit=limit)
