"""Import historical OHLC data from MetaTrader 5 into Pulse via /api/ingest.

Usage examples:

    # Import last 30 days of WIN$N M5 candles (uses already-open MT5 terminal)
    python import_history.py --symbols "WIN$N" --tfs M5 --from 2026-03-26 --to 2026-04-26 \
        --token pulse-mt5-token-2026

    # Multiple symbols and timeframes
    python import_history.py --symbols "WIN$N,WDO$N" --tfs M5,M15 \
        --from 2026-01-01 --to 2026-04-26 --token pulse-mt5-token-2026

    # Override map: tell ingest these candles belong to "WINFUT" (Pulse's canonical name)
    python import_history.py --symbols "WIN$N" --map-symbol WINFUT --tfs M5 \
        --from 2026-04-01 --to 2026-04-26 --token pulse-mt5-token-2026

The script appends ?historical=1 to the ingest URL so the rule engine is NOT
triggered (avoids generating fake alerts from old candles).
"""

import argparse
import logging
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

try:
    import MetaTrader5 as mt5
except ImportError:
    print("ERROR: MetaTrader5 package not installed. Run: pip install MetaTrader5")
    sys.exit(1)

from ingest_client import IngestClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("import_history")

TF_MAP: dict[str, int] = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
}


def parse_date(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)


def connect_mt5() -> None:
    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialize() failed: {mt5.last_error()}")

    login = int(os.environ.get("MT5_LOGIN", "0"))
    password = os.environ.get("MT5_PASSWORD", "")
    server = os.environ.get("MT5_SERVER", "")
    if login and password:
        if not mt5.login(login, password=password, server=server):
            raise RuntimeError(f"MT5 login failed: {mt5.last_error()}")

    account = mt5.account_info()
    if account is None:
        raise RuntimeError("Failed to get MT5 account info — is the terminal logged in?")
    logger.info(
        f"MT5 connected — account {account.login}, server {account.server}, "
        f"balance {account.balance}"
    )


def import_one(
    client: IngestClient,
    mt5_symbol: str,
    pulse_symbol: str,
    tf_name: str,
    start: datetime,
    end: datetime,
) -> int:
    tf_const = TF_MAP[tf_name]

    if not mt5.symbol_select(mt5_symbol, True):
        logger.warning(f"Could not select symbol {mt5_symbol} — skipping")
        return 0

    rates = mt5.copy_rates_range(mt5_symbol, tf_const, start, end)
    if rates is None or len(rates) == 0:
        logger.warning(
            f"No candles returned for {mt5_symbol} {tf_name} between {start} and {end}"
        )
        return 0

    logger.info(
        f"{mt5_symbol} {tf_name}: pulled {len(rates)} candles, sending as {pulse_symbol}..."
    )

    for r in rates:
        client.enqueue(
            {
                "v": 1,
                "source": "mt5",
                "type": "candle",
                "symbol": pulse_symbol,
                "tf": tf_name,
                "ts": int(r["time"]) * 1000,
                "data": {
                    "open": float(r["open"]),
                    "high": float(r["high"]),
                    "low": float(r["low"]),
                    "close": float(r["close"]),
                    "volume": int(r["tick_volume"]),
                },
            }
        )

    return len(rates)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import MT5 historical candles into Pulse",
    )
    parser.add_argument(
        "--symbols",
        required=True,
        help="MT5 symbol(s), comma-separated (e.g. 'WIN$N,WDO$N' or 'WINJ26')",
    )
    parser.add_argument(
        "--map-symbol",
        default=None,
        help="Override target symbol name in Pulse (only valid with a single --symbols)",
    )
    parser.add_argument(
        "--tfs",
        default="M5",
        help="Timeframe(s), comma-separated (M1,M5,M15,M30,H1)",
    )
    parser.add_argument("--from", dest="from_date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--to", dest="to_date", required=True, help="YYYY-MM-DD")
    parser.add_argument(
        "--ingest-url",
        default=None,
        help="Override INGEST_URL (default: from .env)",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="MT5 ingest token (default: $INGEST_TOKEN_MT5 or $INGEST_TOKEN)",
    )
    args = parser.parse_args()

    symbols = [s.strip() for s in args.symbols.split(",") if s.strip()]
    tfs = [t.strip() for t in args.tfs.split(",") if t.strip()]

    if args.map_symbol and len(symbols) != 1:
        parser.error("--map-symbol can only be used with a single symbol")

    for tf in tfs:
        if tf not in TF_MAP:
            parser.error(f"Unsupported timeframe: {tf}. Use one of {list(TF_MAP)}.")

    start = parse_date(args.from_date)
    end = parse_date(args.to_date)
    if end <= start:
        parser.error("--to must be after --from")

    base_url = args.ingest_url or os.environ.get(
        "INGEST_URL", "http://localhost:3000/api/ingest"
    )
    sep = "&" if "?" in base_url else "?"
    ingest_url = f"{base_url}{sep}historical=1"

    token = args.token or os.environ.get("INGEST_TOKEN_MT5") or os.environ.get(
        "INGEST_TOKEN", ""
    )
    if not token:
        parser.error("No ingest token. Pass --token or set INGEST_TOKEN_MT5.")

    client = IngestClient(url=ingest_url, token=token)

    logger.info(f"Ingest URL: {ingest_url}")
    logger.info(f"Range: {start.isoformat()} -> {end.isoformat()}")
    logger.info(f"Symbols: {symbols} (mapped to: {args.map_symbol or 'same'})")
    logger.info(f"Timeframes: {tfs}")

    try:
        connect_mt5()
        total = 0
        for mt5_symbol in symbols:
            pulse_symbol = args.map_symbol or mt5_symbol
            for tf in tfs:
                total += import_one(client, mt5_symbol, pulse_symbol, tf, start, end)
                client.flush_all()
        logger.info(f"Done — sent {total} candles total")
    finally:
        client.flush_all()
        mt5.shutdown()


if __name__ == "__main__":
    main()
