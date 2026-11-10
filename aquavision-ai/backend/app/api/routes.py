import logging
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

import cv2
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse

from app.core.config import (
    ALLOWED_VIDEO_EXTENSIONS,
    MAX_UPLOAD_BYTES,
    MODEL_PATHS,
    OUTPUT_ROOT,
)
from app.services.jobs import create_job, get_job, list_jobs, public_job
from app.services.processing import process_job, utc_now
from app.services.reports import build_csv_report, build_pdf_report


logger = logging.getLogger(__name__)
router = APIRouter()


def _validate_video(path: Path) -> None:
    capture = cv2.VideoCapture(str(path))
    try:
        if not capture.isOpened():
            raise HTTPException(status_code=422, detail="Uploaded file is not a readable video.")
        has_frame, _ = capture.read()
        if not has_frame:
            raise HTTPException(status_code=422, detail="Uploaded video contains no readable frames.")
    finally:
        capture.release()


def _remove_failed_upload(input_path: Path, job_dir: Path) -> None:
    input_path.unlink(missing_ok=True)
    try:
        job_dir.rmdir()
    except OSError:
        logger.exception("Could not remove failed upload directory %s", job_dir)


def _require_job(job_id: str) -> Dict[str, Any]:
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Processing job not found.")
    return job


def _require_completed(job: Dict[str, Any]) -> Dict[str, Any]:
    if job["status"] != "completed" or "results" not in job:
        raise HTTPException(
            status_code=409,
            detail=f"Results are unavailable while this job is {job['status']}.",
        )
    return job["results"]


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/models")
async def list_models():
    return [
        {
            "id": model_id,
            "name": (
                "DeepFish multi-class"
                if model_id == "deepfish_multi_m.pt"
                else "F4K single-class"
            ),
            "available": model_path.is_file(),
        }
        for model_id, model_path in MODEL_PATHS.items()
    ]


@router.post("/jobs", status_code=202)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model: str = Form("deepfish_multi_m.pt"),
):
    if model not in MODEL_PATHS:
        raise HTTPException(status_code=422, detail="Unsupported model selection.")
    if not MODEL_PATHS[model].is_file():
        raise HTTPException(status_code=503, detail=f"Model weights are missing: {model}.")

    original_name = Path((file.filename or "video").replace("\\", "/")).name
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported video format. Allowed: {', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))}.",
        )

    job_id = uuid.uuid4().hex
    job_dir = OUTPUT_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=False)
    input_path = job_dir / f"input{extension}"
    total_bytes = 0
    try:
        with input_path.open("wb") as destination:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Video exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit.",
                    )
                destination.write(chunk)
        if total_bytes == 0:
            raise HTTPException(status_code=422, detail="Uploaded video is empty.")
        await run_in_threadpool(_validate_video, input_path)
    except HTTPException:
        _remove_failed_upload(input_path, job_dir)
        raise
    except OSError as exc:
        _remove_failed_upload(input_path, job_dir)
        logger.exception("Could not save uploaded video")
        raise HTTPException(status_code=500, detail="Could not store uploaded video.") from exc
    finally:
        await file.close()

    job = {
        "id": job_id,
        "filename": original_name,
        "model": model,
        "status": "queued",
        "progress": {"frame_number": 0, "total_frames": None},
        "summary": None,
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "started_at": None,
        "completed_at": None,
        "input_path": str(input_path),
        "output_dir": str(job_dir),
    }
    create_job(job)
    background_tasks.add_task(process_job, job_id)
    return public_job(job)


@router.get("/jobs")
async def get_jobs():
    return [public_job(job) for job in list_jobs()]


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    return public_job(_require_job(job_id))


@router.get("/jobs/{job_id}/results")
async def get_job_results(job_id: str):
    job = _require_job(job_id)
    return _require_completed(job)


@router.get("/jobs/{job_id}/species")
async def get_job_species(job_id: str):
    result = _require_completed(_require_job(job_id))
    return result["summary"]["species_counts"]


@router.get("/jobs/{job_id}/video")
async def get_annotated_video(job_id: str):
    job = _require_job(job_id)
    _require_completed(job)
    video_path = job.get("annotated_video")
    if not video_path or not Path(video_path).is_file():
        raise HTTPException(status_code=404, detail="Annotated video is unavailable.")
    return FileResponse(video_path, media_type="video/mp4", filename=f"{job_id}-annotated.mp4")


@router.get("/jobs/{job_id}/reports/{report_format}")
async def download_report(job_id: str, report_format: str):
    result = _require_completed(_require_job(job_id))
    filename = f"aquavision-{job_id}"
    if report_format == "json":
        return JSONResponse(
            content=result,
            headers={"Content-Disposition": f'attachment; filename="{filename}.json"'},
        )
    if report_format == "csv":
        content = build_csv_report(result)
        return StreamingResponse(
            iter([content]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
    if report_format == "pdf":
        content = build_pdf_report(result)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
        )
    raise HTTPException(status_code=404, detail="Report format must be json, csv, or pdf.")


@router.get("/analytics")
async def get_analytics():
    completed = [
        job for job in list_jobs()
        if job["status"] == "completed" and "results" in job
    ]
    summaries = [job["results"]["summary"] for job in completed]
    confidence_values = [
        job["results"]["summary"]["confidence"]
        for job in completed
        if job["results"]["summary"]["confidence"]["count"]
    ]
    confidence_count = sum(item["count"] for item in confidence_values)
    confidence_mean = (
        sum(item["mean"] * item["count"] for item in confidence_values) / confidence_count
        if confidence_count
        else None
    )
    histogram = Counter()
    for item in confidence_values:
        histogram.update(item["histogram"])
    species_counts = Counter()
    species_confidence_totals: Dict[str, Dict[str, float]] = {}
    for summary in summaries:
        species_counts.update(summary["species_counts"])
        for species, statistics in summary["species_confidence"].items():
            totals = species_confidence_totals.setdefault(
                species,
                {"track_count": 0, "weighted_mean": 0.0, "min": 1.0, "max": 0.0},
            )
            totals["track_count"] += statistics["track_count"]
            totals["weighted_mean"] += statistics["mean"] * statistics["track_count"]
            totals["min"] = min(totals["min"], statistics["min"])
            totals["max"] = max(totals["max"], statistics["max"])
    species_confidence = {
        species: {
            "track_count": int(statistics["track_count"]),
            "min": statistics["min"],
            "mean": statistics["weighted_mean"] / statistics["track_count"],
            "max": statistics["max"],
        }
        for species, statistics in sorted(species_confidence_totals.items())
    }

    frame_counts = [
        {
            "job_id": job["id"],
            "filename": job["filename"],
            **frame,
        }
        for job in completed
        for frame in job["results"]["summary"]["frame_counts"]
    ]
    track_durations = [
        track["duration_seconds"]
        for job in completed
        for track in job["results"]["tracks"]
        if track["duration_seconds"] is not None
    ]

    return {
        "videos_processed": len(completed),
        "total_detections": sum(item["total_detections"] for item in summaries),
        "unique_fish_count": sum(item["unique_fish_count"] for item in summaries),
        "species_count": len(species_counts),
        "species_counts": dict(sorted(species_counts.items())),
        "species_confidence": species_confidence,
        "confidence": {
            "count": confidence_count,
            "min": min((item["min"] for item in confidence_values), default=None),
            "mean": confidence_mean,
            "max": max((item["max"] for item in confidence_values), default=None),
            "histogram": dict(sorted(histogram.items())),
        },
        "average_track_duration_seconds": (
            sum(track_durations) / len(track_durations) if track_durations else None
        ),
        "frame_counts": frame_counts,
        "evaluation": None,
        "evaluation_unavailable_reason": "No ground-truth annotations were supplied for these uploaded videos.",
        "recent_jobs": [public_job(job) for job in list_jobs()[:10]],
    }
