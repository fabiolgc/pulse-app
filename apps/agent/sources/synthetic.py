"""Synthetic data source for development and testing."""

import math
import time
import random
from typing import Iterator, Any


class SyntheticSource:
    """Generates deterministic fake candle data for testing the full pipeline."""

    name = "synthetic"

    def __init__(self) -> None:
        self._symbols: list[str] = []
        self._timeframes: list[str] = []
        self._running = False
        self._base_prices: dict[str, float] = {
            "WINFUT": 128000.0,
            "WDOFUT": 5150.0,
        }

    def connect(self) -> None:
        print(f"[{self.name}] Connected (synthetic data generator)")
        self._running = True

    def subscribe(self, symbols: list[str], timeframes: list[str]) -> None:
        self._symbols = symbols
        self._timeframes = timeframes
        print(f"[{self.name}] Subscribed: {symbols} @ {timeframes}")

    def iter_events(self) -> Iterator[dict[str, Any]]:
        tick_count = 0
        while self._running:
            now_ms = int(time.time() * 1000)
            tick_count += 1

            for symbol in self._symbols:
                base = self._base_prices.get(symbol, 100000.0)
                # Sine wave + noise for realistic-ish movement
                trend = math.sin(tick_count * 0.05) * base * 0.002
                noise = random.gauss(0, base * 0.0005)
                price = base + trend + noise

                # Emit tick
                yield {
                    "v": 1,
                    "source": self.name,
                    "type": "tick",
                    "symbol": symbol,
                    "ts": now_ms,
                    "data": {
                        "bid": round(price - 5, 2),
                        "ask": round(price + 5, 2),
                        "last": round(price, 2),
                        "volume": random.randint(10, 500),
                    },
                }

                # Emit candle every 10 ticks (simulating M5 close)
                if tick_count % 10 == 0:
                    for tf in self._timeframes:
                        open_price = price + random.gauss(0, base * 0.001)
                        high = max(price, open_price) + abs(random.gauss(0, base * 0.0008))
                        low = min(price, open_price) - abs(random.gauss(0, base * 0.0008))
                        yield {
                            "v": 1,
                            "source": self.name,
                            "type": "candle",
                            "symbol": symbol,
                            "tf": tf,
                            "ts": now_ms,
                            "data": {
                                "open": round(open_price, 2),
                                "high": round(high, 2),
                                "low": round(low, 2),
                                "close": round(price, 2),
                                "volume": random.randint(1000, 50000),
                            },
                        }

            # Heartbeat every 30 ticks
            if tick_count % 30 == 0:
                yield {
                    "v": 1,
                    "source": self.name,
                    "type": "heartbeat",
                    "symbol": self._symbols[0] if self._symbols else "WINFUT",
                    "ts": now_ms,
                    "data": {},
                }

            time.sleep(1)  # 1 tick per second

    def close(self) -> None:
        self._running = False
        print(f"[{self.name}] Closed")
