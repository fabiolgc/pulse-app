"""Pulse Agent — reads market data from a configurable source and pushes to cloud."""

import os
import sys
import signal
import logging

from dotenv import load_dotenv

load_dotenv()

from ingest_client import IngestClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("agent.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("agent")


def resolve_source():
    """Resolve which data source to use from the SOURCE env var."""
    source_name = os.environ.get("SOURCE", "synthetic").lower()

    if source_name == "mt5":
        from sources.mt5 import MT5Source
        return MT5Source()
    elif source_name == "cedro":
        raise NotImplementedError("CedroSource not yet implemented")
    elif source_name == "nelogica":
        raise NotImplementedError("NelogicaSource not yet implemented")
    elif source_name == "synthetic":
        from sources.synthetic import SyntheticSource
        return SyntheticSource()
    else:
        raise ValueError(f"Unknown SOURCE: {source_name}")


def main() -> None:
    source = resolve_source()
    client = IngestClient()

    symbols = os.environ.get("SYMBOLS", "WINFUT,WDOFUT").split(",")
    timeframes = os.environ.get("TIMEFRAMES", "M5").split(",")

    # Graceful shutdown
    def handle_shutdown(signum, frame):
        logger.info("Shutting down...")
        source.close()
        client.flush()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    logger.info(f"Starting agent with source={source.name}")
    logger.info(f"Symbols: {symbols}, Timeframes: {timeframes}")
    logger.info(f"Ingest URL: {os.environ.get('INGEST_URL', 'http://localhost:3000/api/ingest')}")

    source.connect()
    source.subscribe(symbols, timeframes)

    try:
        for event in source.iter_events():
            logger.debug(f"Event: {event['type']} {event.get('symbol', '')}")
            client.enqueue(event)
    except KeyboardInterrupt:
        pass
    finally:
        source.close()
        client.flush()
        logger.info("Agent stopped")


if __name__ == "__main__":
    main()
