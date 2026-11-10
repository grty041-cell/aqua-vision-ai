import json
import logging
import threading
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import torch
from ultralytics import YOLO

from app.core.config import MODEL_PATHS, REPOSITORY_ROOT
from app.services.detection import summarize_video
from app.services.jobs import get_job, update_job
from src.pipeline import run_standard_pipeline


logger = logging.getLogger(__name__)
PROCESSING_LOCK = threading.Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def process_job(job_id: str) -> None:
    job = get_job(job_id)
    if job is None:
        logger.error("Cannot process missing job %s", job_id)
        return

    try:
        with PROCESSING_LOCK:
            job = get_job(job_id)
            if job is None:
                logger.error("Job %s was removed before processing", job_id)
                return

            model_path = MODEL_PATHS[job["model"]]
            if not model_path.is_file():
                raise FileNotFoundError(f"Model weights not found: {model_path}")

            capture = cv2.VideoCapture(job["input_path"])
            if not capture.isOpened():
                capture.release()
                raise ValueError("The uploaded file could not be opened as a video.")
            fps_value = capture.get(cv2.CAP_PROP_FPS)
            frame_total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
            capture.release()
            fps: Optional[float] = fps_value if fps_value > 0 else None

            update_job(
                job_id,
                status="processing",
                started_at=utc_now(),
                progress={"frame_number": 0, "total_frames": frame_total},
            )

            model = YOLO(str(model_path))
            model.to("cuda" if torch.cuda.is_available() else "cpu")
            frames: List[Dict[str, Any]] = []
            tracks: Dict[int, Dict[str, Any]] = defaultdict(
                lambda: {
                    "track_id": None,
                    "species": None,
                    "best_confidence": 0.0,
                    "first_frame": None,
                    "last_frame": None,
                    "observed_frames": 0,
                }
            )

            def on_frame(frame_number: int, detections: List[Dict[str, Any]]) -> None:
                frames.append(
                    {"frame_number": frame_number, "detections": detections}
                )
                for detection in detections:
                    track = tracks[detection["track_id"]]
                    track["track_id"] = detection["track_id"]
                    track["observed_frames"] += 1
                    if track["first_frame"] is None:
                        track["first_frame"] = frame_number
                    track["last_frame"] = frame_number
                    if detection["confidence"] > track["best_confidence"]:
                        track["best_confidence"] = detection["confidence"]
                        track["species"] = detection["species"]
                update_job(
                    job_id,
                    progress={"frame_number": frame_number, "total_frames": frame_total},
                )

            tracker_config = REPOSITORY_ROOT / "src" / "tracker" / "bytetrack.yaml"
            output_paths = run_standard_pipeline(
                model,
                job["input_path"],
                job["output_dir"],
                str(tracker_config),
                show_window=False,
                on_frame=on_frame,
            )

            track_rows = []
            for track in tracks.values():
                frame_span = track["last_frame"] - track["first_frame"] + 1
                track_rows.append(
                    {
                        **track,
                        "duration_seconds": frame_span / fps if fps else None,
                    }
                )
            track_rows.sort(key=lambda item: item["track_id"])
            summary = summarize_video(frames, track_rows, fps)
            result = {
                "job_id": job_id,
                "filename": job["filename"],
                "model": job["model"],
                "created_at": job["created_at"],
                "completed_at": utc_now(),
                "source_fps": fps,
                "summary": summary,
                "tracks": track_rows,
                "frames": frames,
                "annotated_video_available": bool(
                    output_paths["video_path"]
                    and Path(output_paths["video_path"]).is_file()
                ),
                "tracking_log_available": bool(
                    output_paths["tracking_path"]
                    and Path(output_paths["tracking_path"]).is_file()
                ),
                "evaluation": None,
            }
            result_path = Path(job["output_dir"]) / "results.json"
            result_path.write_text(
                json.dumps(result, indent=2, allow_nan=False),
                encoding="utf-8",
            )
            update_job(
                job_id,
                status="completed",
                progress={"frame_number": len(frames), "total_frames": frame_total},
                summary=summary,
                results_path=str(result_path),
                annotated_video=output_paths["video_path"],
                completed_at=result["completed_at"],
                results=result,
            )
    except Exception as exc:
        logger.exception("Video processing failed for job %s", job_id)
        update_job(
            job_id,
            status="failed",
            error=f"{type(exc).__name__}: {exc}",
            completed_at=utc_now(),
        )
