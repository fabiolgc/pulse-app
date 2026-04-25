"""Market data source interface and registry."""

from typing import Protocol, Iterator, Any, runtime_checkable


@runtime_checkable
class MarketDataSource(Protocol):
    """Contract that every data source must implement."""

    name: str

    def connect(self) -> None:
        """Authenticate / initialize connection to the data provider."""
        ...

    def subscribe(self, symbols: list[str], timeframes: list[str]) -> None:
        """Start receiving data for given symbols and timeframes."""
        ...

    def iter_events(self) -> Iterator[dict[str, Any]]:
        """Yield standardized ingest envelope dicts (v=1 format)."""
        ...

    def close(self) -> None:
        """Clean up resources."""
        ...
