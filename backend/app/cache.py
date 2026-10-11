"""A tiny in-process TTL cache for read-only rollups that many requests ask for (the Hall, the admin pages).

It is per server process. That is fine for one small instance: the worst case is that a number is up to
`CACHE_SECONDS` old (default 20), and anything that changes the answer on purpose calls `clear()` first.
Set CACHE_SECONDS=0 to turn it off (the tests do).
"""
import threading
import time
from typing import Any, Callable, Dict, Tuple

from . import config

_lock = threading.Lock()
_store: Dict[Any, Tuple[float, Any]] = {}


def get_or_set(key: Any, compute: Callable[[], Any]) -> Any:
    ttl = config.cache_seconds()
    if ttl <= 0:
        return compute()
    now = time.monotonic()
    with _lock:
        hit = _store.get(key)
        if hit and now - hit[0] < ttl:
            return hit[1]
    value = compute()
    with _lock:
        if len(_store) > 500:        # never grow without bound
            _store.clear()
        _store[key] = (time.monotonic(), value)
    return value


def clear() -> None:
    with _lock:
        _store.clear()
