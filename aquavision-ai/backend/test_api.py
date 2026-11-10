from fastapi.testclient import TestClient

from app.main import app
from app.api import routes
from app.services.detection import summarize_video
from app.services.reports import build_csv_report, build_pdf_report


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_missing_job_returns_not_found():
    response = client.get("/api/v1/jobs/not-a-job")

    assert response.status_code == 404


def test_upload_rejects_unreadable_video_and_cleans_up(tmp_path, monkeypatch):
    monkeypatch.setattr(routes, "OUTPUT_ROOT", tmp_path)

    response = client.post(
        "/api/v1/jobs",
        files={"file": ("not-a-video.mp4", b"not a video", "video/mp4")},
        data={"model": "deepfish_multi_m.pt"},
    )

    assert response.status_code == 422
    assert list(tmp_path.iterdir()) == []


def test_video_summary_counts_tracks_and_confidence():
    frames = [
        {
            "frame_number": 1,
            "detections": [
                {"confidence": 0.8},
                {"confidence": 0.6},
            ],
        },
        {"frame_number": 2, "detections": [{"confidence": 0.9}]},
    ]
    tracks = [
        {"species": "Fish A", "best_confidence": 0.8, "duration_seconds": 2.0},
        {"species": "Fish A", "best_confidence": 0.7, "duration_seconds": None},
    ]

    summary = summarize_video(frames, tracks, fps=30)

    assert summary["processed_frames"] == 2
    assert summary["total_detections"] == 3
    assert summary["unique_fish_count"] == 2
    assert summary["species_counts"] == {"Fish A": 2}
    assert summary["species_confidence"]["Fish A"]["mean"] == 0.75
    assert summary["confidence"]["mean"] == 0.7666666666666666
    assert summary["average_track_duration_seconds"] == 2.0
    assert sum(summary["confidence"]["histogram"].values()) == 3


def test_empty_summary_does_not_invent_confidence_or_duration():
    summary = summarize_video([], [], fps=None)

    assert summary["total_detections"] == 0
    assert summary["confidence"]["min"] is None
    assert summary["confidence"]["mean"] is None
    assert summary["confidence"]["max"] is None
    assert summary["average_track_duration_seconds"] is None


def test_reports_contain_processing_results():
    result = {
        "job_id": "job-1",
        "filename": "sample.mp4",
        "model": "f4k_single_m.pt",
        "created_at": "2026-11-10T09:00:00+00:00",
        "completed_at": "2026-11-10T10:00:00+00:00",
        "summary": {
            "processed_frames": 1,
            "total_detections": 1,
            "unique_fish_count": 1,
            "species_counts": {"fish": 1},
            "confidence": {
                "count": 1,
                "min": 0.9,
                "mean": 0.9,
                "max": 0.9,
                "histogram": {},
            },
            "average_track_duration_seconds": 1.0,
            "longest_track_duration_seconds": 1.0,
            "frame_counts": [{"frame_number": 1, "count": 1}],
        },
        "frames": [
            {
                "frame_number": 1,
                "detections": [
                    {
                        "track_id": 1,
                        "species": "fish",
                        "confidence": 0.9,
                        "bbox_xyxy": [1.0, 2.0, 3.0, 4.0],
                    }
                ],
            }
        ],
        "tracks": [],
    }

    csv_report = build_csv_report(result)
    pdf_report = build_pdf_report(result)

    assert "summary,job-1,sample.mp4" in csv_report
    assert "detection,job-1,sample.mp4" in csv_report
    assert "1,fish,0.9,1.0,2.0,3.0,4.0" in csv_report
    assert pdf_report.startswith(b"%PDF")
