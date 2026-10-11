"""
A tiny in-memory sliding-window rate limiter (per process).

Good enough for one Railway instance. If you ever run several instances, move this to Redis.
"""
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException

from . import config


class RateLimiter:
    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, window: float, now: float) -> Deque[float]:
        q = self._hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if not q:
            self._hits.pop(key, None)
            return deque()
        return q

    def check(self, key: str, limit: int, window: float) -> None:
        """Raise 429 if `key` already has `limit` recorded hits inside the window."""
        if not config.rate_limit_enabled():
            return
        now = time.monotonic()
        with self._lock:
            q = self._prune(key, window, now)
            if len(q) >= limit:
                retry = max(1, int(window - (now - q[0])))
                raise HTTPException(
                    status_code=429,
                    detail="Too many attempts. Try again in {} seconds.".format(retry),
                    headers={"Retry-After": str(retry)},
                )

    def hit(self, key: str, window: float) -> None:
        now = time.monotonic()
        with self._lock:
            self._prune(key, window, now)
            self._hits[key].append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()
