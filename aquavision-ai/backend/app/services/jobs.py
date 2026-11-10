from threading import RLock
from typing import Any, Dict, List, Optional


JOBS: Dict[str, Dict[str, Any]] = {}
JOBS_LOCK = RLock()


def create_job(job: Dict[str, Any]) -> None:
    with JOBS_LOCK:
        JOBS[job["id"]] = job


def update_job(job_id: str, **updates: Any) -> None:
    with JOBS_LOCK:
        if job_id not in JOBS:
            raise KeyError(f"Unknown job: {job_id}")
        JOBS[job_id].update(updates)


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        return dict(job) if job is not None else None


def list_jobs() -> List[Dict[str, Any]]:
    with JOBS_LOCK:
        return [
            dict(job)
            for job in sorted(
                JOBS.values(),
                key=lambda item: item["created_at"],
                reverse=True,
            )
        ]


def public_job(job: Dict[str, Any]) -> Dict[str, Any]:
    return {
        key: job[key]
        for key in (
            "id",
            "filename",
            "model",
            "status",
            "progress",
            "summary",
            "error",
            "created_at",
            "started_at",
            "completed_at",
        )
        if key in job
    }
