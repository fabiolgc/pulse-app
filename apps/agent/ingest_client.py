"""HTTP client for sending data to the cloud ingest endpoint."""

import json
import time
import os
import logging
from collections import deque
from typing import Any

import requests

logger = logging.getLogger("ingest_client")

BUFFER_MAX_SIZE = 10_000
BATCH_SIZE = 50
FLUSH_INTERVAL_SECONDS = 2
MAX_RETRIES = 5
BACKOFF_BASE = 2


class IngestClient:
    """Buffers events and sends them in batches to /api/ingest via HTTP POST."""

    def __init__(self) -> None:
        self._url = os.environ.get("INGEST_URL", "http://localhost:3000/api/ingest")
        self._token = os.environ.get("INGEST_TOKEN", "")
        self._buffer: deque[dict[str, Any]] = deque(maxlen=BUFFER_MAX_SIZE)
        self._last_flush = time.time()

    def enqueue(self, envelope: dict[str, Any]) -> None:
        """Add an event to the send buffer."""
        self._buffer.append(envelope)
        if (
            len(self._buffer) >= BATCH_SIZE
            or time.time() - self._last_flush > FLUSH_INTERVAL_SECONDS
        ):
            self.flush()

    def flush(self) -> None:
        """Send all buffered events to the ingest endpoint."""
        if not self._buffer:
            return

        batch = []
        while self._buffer and len(batch) < BATCH_SIZE:
            batch.append(self._buffer.popleft())

        self._last_flush = time.time()
        self._send_with_retry(batch)

    def _send_with_retry(self, batch: list[dict[str, Any]]) -> None:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._token}",
        }
        payload = json.dumps(batch)

        for attempt in range(MAX_RETRIES):
            try:
                resp = requests.post(
                    self._url, data=payload, headers=headers, timeout=10
                )
                if resp.status_code == 200:
                    data = resp.json()
                    inserted = data.get("inserted", 0)
                    errors = data.get("errors")
                    if inserted > 0:
                        logger.info(f"Sent {inserted} events")
                    if errors:
                        logger.warning(f"Ingest errors: {errors}")
                    return
                elif resp.status_code == 401:
                    logger.error("Authentication failed — check INGEST_TOKEN")
                    return
                else:
                    logger.warning(
                        f"Ingest returned {resp.status_code}: {resp.text}"
                    )
            except requests.RequestException as err:
                logger.warning(f"Request failed (attempt {attempt + 1}): {err}")

            backoff = BACKOFF_BASE**attempt
            logger.info(f"Retrying in {backoff}s...")
            time.sleep(backoff)

        # All retries failed — put events back in buffer
        logger.error(f"All retries failed, re-buffering {len(batch)} events")
        for event in reversed(batch):
            self._buffer.appendleft(event)
