from abc import ABC, abstractmethod


class BaseAgent(ABC):
    @abstractmethod
    def run(self, config: dict, input: str) -> str:
        """Execute agent logic. Returns output string or raises on error."""
        ...

    def schema(self) -> dict:
        """Returns the AgentSchema dict for this agent. Override in subclass."""
        raise NotImplementedError
