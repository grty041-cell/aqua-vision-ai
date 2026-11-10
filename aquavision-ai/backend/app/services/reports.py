import csv
import io
import json
from typing import Any, Dict

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


def build_csv_report(result: Dict[str, Any]) -> str:
    output = io.StringIO(newline="")
    fields = [
        "record_type",
        "job_id",
        "filename",
        "model",
        "created_at",
        "completed_at",
        "processed_frames",
        "total_detections",
        "unique_fish_count",
        "species_counts",
        "confidence_mean",
        "frame_number",
        "track_id",
        "species",
        "confidence",
        "x1",
        "y1",
        "x2",
        "y2",
    ]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    summary = result["summary"]
    writer.writerow(
        {
            "record_type": "summary",
            "job_id": result["job_id"],
            "filename": result["filename"],
            "model": result["model"],
            "created_at": result["created_at"],
            "completed_at": result["completed_at"],
            "processed_frames": summary["processed_frames"],
            "total_detections": summary["total_detections"],
            "unique_fish_count": summary["unique_fish_count"],
            "species_counts": json.dumps(summary["species_counts"], sort_keys=True),
            "confidence_mean": summary["confidence"]["mean"],
        }
    )
    for frame in result["frames"]:
        for detection in frame["detections"]:
            x1, y1, x2, y2 = detection["bbox_xyxy"]
            writer.writerow(
                {
                    "record_type": "detection",
                    "job_id": result["job_id"],
                    "filename": result["filename"],
                    "model": result["model"],
                    "created_at": result["created_at"],
                    "completed_at": result["completed_at"],
                    "frame_number": frame["frame_number"],
                    "track_id": detection["track_id"],
                    "species": detection["species"],
                    "confidence": detection["confidence"],
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                }
            )
    return output.getvalue()


def build_pdf_report(result: Dict[str, Any]) -> bytes:
    output = io.BytesIO()
    document = canvas.Canvas(output, pagesize=letter)
    page_width, page_height = letter
    y = page_height - 54
    summary = result["summary"]

    lines = [
        "AquaVision AI - Video analysis report",
        f"Video: {result['filename']}",
        f"Model: {result['model']}",
        f"Completed: {result['completed_at']}",
        f"Processed frames: {summary['processed_frames']}",
        f"Tracked detections: {summary['total_detections']}",
        f"Unique track IDs: {summary['unique_fish_count']}",
        "Species/class counts (one count per track ID):",
    ]
    lines.extend(
        f"  {species}: {count}"
        for species, count in summary["species_counts"].items()
    )
    confidence = summary["confidence"]
    lines.extend(
        [
            "Detection confidence:",
            f"  Count: {confidence['count']}",
            f"  Min / mean / max: {confidence['min']} / {confidence['mean']} / {confidence['max']}",
            f"Average track duration (seconds): {summary['average_track_duration_seconds']}",
            "Evaluation metrics: unavailable (no ground truth was supplied for this video).",
            "",
            "ID-based counts can undercount or overcount fish if ByteTrack loses an ID",
            "or assigns a new ID after a long occlusion or interruption.",
        ]
    )
    document.setTitle("AquaVision AI video report")
    document.setFont("Helvetica", 10)
    for line in lines:
        if y < 54:
            document.showPage()
            document.setFont("Helvetica", 10)
            y = page_height - 54
        document.drawString(48, y, line[:120])
        y -= 16
    document.save()
    output.seek(0)
    return output.getvalue()
