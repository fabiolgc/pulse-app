"""MetaTrader 5 data source."""

import os
import time
from datetime import datetime, timezone
from typing import Iterator, Any

try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None  # type: ignore[assignment]

# MT5 timeframe mapping
TF_MAP: dict[str, int] = {}
if mt5 is not None:
    TF_MAP = {
        "M1": mt5.TIMEFRAME_M1,
        "M5": mt5.TIMEFRAME_M5,
        "M15": mt5.TIMEFRAME_M15,
        "M30": mt5.TIMEFRAME_M30,
        "H1": mt5.TIMEFRAME_H1,
    }


class MT5Source:
    """Reads real-time data from MetaTrader 5 via the Python library."""

    name = "mt5"

    def __init__(self) -> None:
        self._symbols: list[str] = []
        self._timeframes: list[str] = []
        self._running = False
        self._last_candle_time: dict[str, int] = {}

    def connect(self) -> None:
        if mt5 is None:
            raise RuntimeError(
                "MetaTrader5 package not installed. Run: pip install MetaTrader5"
            )

        login = int(os.environ.get("MT5_LOGIN", "0"))
        password = os.environ.get("MT5_PASSWORD", "")
        server = os.environ.get("MT5_SERVER", "")
        # MT5_PATH aponta pro terminal64.exe específico desta conta — necessário
        # quando há múltiplas instalações de MT5 (XP + Hantec + ...) abertas.
        path = os.environ.get("MT5_PATH", "").strip()

        init_ok = mt5.initialize(path=path) if path else mt5.initialize()
        if not init_ok:
            raise RuntimeError(f"MT5 initialize() failed: {mt5.last_error()}")

        if login and password:
            authorized = mt5.login(login, password=password, server=server)
            if not authorized:
                raise RuntimeError(f"MT5 login failed: {mt5.last_error()}")

        account = mt5.account_info()
        if account is None:
            raise RuntimeError("Failed to get MT5 account info")

        print(
            f"[mt5] Connected — account {account.login}, "
            f"balance {account.balance}, server {account.server}"
        )
        self._running = True

    def subscribe(self, symbols: list[str], timeframes: list[str]) -> None:
        self._symbols = symbols
        self._timeframes = timeframes
        for symbol in symbols:
            if not mt5.symbol_select(symbol, True):
                print(f"[mt5] Warning: could not select symbol {symbol}")
        print(f"[mt5] Subscribed: {symbols} @ {timeframes}")

    def iter_events(self) -> Iterator[dict[str, Any]]:
        tick_count = 0
        while self._running:
            now_ms = int(time.time() * 1000)
            tick_count += 1

            for symbol in self._symbols:
                # Get latest tick
                tick = mt5.symbol_info_tick(symbol)
                if tick is not None:
                    yield {
                        "v": 1,
                        "source": self.name,
                        "type": "tick",
                        "symbol": symbol,
                        "ts": now_ms,
                        "data": {
                            "bid": tick.bid,
                            "ask": tick.ask,
                            "last": tick.last,
                            "volume": tick.volume,
                        },
                    }

                # Check for new candles
                for tf in self._timeframes:
                    mt5_tf = TF_MAP.get(tf)
                    if mt5_tf is None:
                        continue
                    rates = mt5.copy_rates_from_pos(symbol, mt5_tf, 0, 2)
                    if rates is None or len(rates) < 2:
                        continue
                    # Use the second-to-last candle (completed)
                    candle = rates[-2]
                    candle_key = f"{symbol}:{tf}"
                    candle_time_ms = int(candle["time"]) * 1000

                    if candle_time_ms != self._last_candle_time.get(candle_key, 0):
                        self._last_candle_time[candle_key] = candle_time_ms
                        yield {
                            "v": 1,
                            "source": self.name,
                            "type": "candle",
                            "symbol": symbol,
                            "tf": tf,
                            "ts": candle_time_ms,
                            "data": {
                                "open": float(candle["open"]),
                                "high": float(candle["high"]),
                                "low": float(candle["low"]),
                                "close": float(candle["close"]),
                                "volume": int(candle["tick_volume"]),
                            },
                        }

            # Heartbeat every 30 iterations
            if tick_count % 30 == 0:
                yield {
                    "v": 1,
                    "source": self.name,
                    "type": "heartbeat",
                    "symbol": self._symbols[0] if self._symbols else "",
                    "ts": now_ms,
                    "data": {},
                }

            time.sleep(1)

    def close(self) -> None:
        self._running = False
        if mt5 is not None:
            mt5.shutdown()
        print("[mt5] Closed")
