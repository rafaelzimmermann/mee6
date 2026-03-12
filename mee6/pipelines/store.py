"""JSON-file persistence for pipelines."""

import json
import uuid
from pathlib import Path

from mee6.pipelines.models import Pipeline

_DEFAULT_PATH = Path("data/pipelines.json")


class PipelineStore:
    def __init__(self, path: Path = _DEFAULT_PATH) -> None:
        self._path = path

    def _load_all(self) -> dict[str, Pipeline]:
        if not self._path.exists():
            return {}
        try:
            raw = json.loads(self._path.read_text())
            return {pid: Pipeline.model_validate(data) for pid, data in raw.items()}
        except (json.JSONDecodeError, OSError):
            return {}

    def _save_all(self, pipelines: dict[str, Pipeline]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps({pid: p.model_dump() for pid, p in pipelines.items()}, indent=2))
        tmp.replace(self._path)

    def list(self) -> list[Pipeline]:
        return list(self._load_all().values())

    def get(self, pipeline_id: str) -> Pipeline | None:
        return self._load_all().get(pipeline_id)

    def upsert(self, pipeline: Pipeline) -> None:
        pipelines = self._load_all()
        pipelines[pipeline.id] = pipeline
        self._save_all(pipelines)

    def delete(self, pipeline_id: str) -> None:
        pipelines = self._load_all()
        pipelines.pop(pipeline_id, None)
        self._save_all(pipelines)

    @staticmethod
    def new_id() -> str:
        return str(uuid.uuid4())


pipeline_store = PipelineStore()
