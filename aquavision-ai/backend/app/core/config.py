from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
OUTPUT_ROOT = REPOSITORY_ROOT / "outputs" / "aquavision-ai"
MODEL_PATHS = {
    "deepfish_multi_m.pt": REPOSITORY_ROOT / "models" / "deepfish_multi_m.pt",
    "f4k_single_m.pt": REPOSITORY_ROOT / "models" / "f4k_single_m.pt",
}
ALLOWED_VIDEO_EXTENSIONS = {".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"}
MAX_UPLOAD_BYTES = 500 * 1024 * 1024
API_PREFIX = "/api/v1"
PROJECT_NAME = "AquaVision AI"
VERSION = "1.0.0"
ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
