"""Cedro data source — stub for future implementation."""


class CedroSource:
    """Placeholder for CedroCrystal WebSocket data source."""

    name = "cedro"

    def connect(self) -> None:
        raise NotImplementedError("CedroSource not yet implemented")

    def subscribe(self, symbols: list[str], timeframes: list[str]) -> None:
        raise NotImplementedError

    def iter_events(self):
        raise NotImplementedError

    def close(self) -> None:
        pass
