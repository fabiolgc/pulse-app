"""Nelogica data source — stub for future implementation."""


class NelogicaSource:
    """Placeholder for Nelogica/Profit DLL data source."""

    name = "nelogica"

    def connect(self) -> None:
        raise NotImplementedError("NelogicaSource not yet implemented")

    def subscribe(self, symbols: list[str], timeframes: list[str]) -> None:
        raise NotImplementedError

    def iter_events(self):
        raise NotImplementedError

    def close(self) -> None:
        pass
