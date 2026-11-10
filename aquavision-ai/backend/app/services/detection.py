from collections import Counter
from typing import Any, Dict, List, Optional


def summarize_video(
    frames: List[Dict[str, Any]],
    tracks: List[Dict[str, Any]],
    fps: Optional[float],
) -> Dict[str, Any]:
    confidences = [
        detection["confidence"]
        for frame in frames
        for detection in frame["detections"]
    ]
    histogram = {
        f"{index / 10:.1f}-{(index + 1) / 10:.1f}": 0
        for index in range(10)
    }
    for confidence in confidences:
        bucket = min(int(confidence * 10), 9)
        histogram[f"{bucket / 10:.1f}-{(bucket + 1) / 10:.1f}"] += 1

    species_counts = Counter(
        track["species"]
        for track in tracks
        if track["species"] not in (None, "", "Unknown", "(tracking...)")
    )
    species_confidences: Dict[str, List[float]] = {}
    for track in tracks:
        species = track["species"]
        if species not in (None, "", "Unknown", "(tracking...)"):
            species_confidences.setdefault(species, []).append(track["best_confidence"])
    durations = [
        track["duration_seconds"]
        for track in tracks
        if track["duration_seconds"] is not None
    ]

    return {
        "processed_frames": len(frames),
        "total_detections": len(confidences),
        "unique_fish_count": len(tracks),
        "species_counts": dict(sorted(species_counts.items())),
        "species_confidence": {
            species: {
                "track_count": len(values),
                "min": min(values),
                "mean": sum(values) / len(values),
                "max": max(values),
            }
            for species, values in sorted(species_confidences.items())
        },
        "confidence": {
            "count": len(confidences),
            "min": min(confidences) if confidences else None,
            "mean": sum(confidences) / len(confidences) if confidences else None,
            "max": max(confidences) if confidences else None,
            "histogram": histogram,
        },
        "average_track_duration_seconds": (
            sum(durations) / len(durations) if durations else None
        ),
        "longest_track_duration_seconds": max(durations) if durations else None,
        "frame_counts": [
            {
                "frame_number": frame["frame_number"],
                "count": len(frame["detections"]),
            }
            for frame in frames
        ],
    }