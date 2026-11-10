# AquaVision AI

AquaVision AI is a local video-analysis application built around the repository's existing pretrained YOLOv8 fish models and Ultralytics ByteTrack integration. It provides video upload, tracked detections, per-video ID-based counts, model-label summaries, annotated video playback, and JSON, CSV, and PDF reports. It does not train models or produce ground-truth evaluation scores for unlabeled uploads.

## Architecture

- `backend/` contains the FastAPI API and in-memory job coordinator.
- `frontend/` contains the React + Vite application.
- `../src/pipeline.py` remains the inference and tracking implementation. The API calls its standard pipeline in headless mode; the existing CLI still uses the normal display behavior and both CLI modes remain available.
- `../models/` contains the pretrained model weights.
- `../outputs/aquavision-ai/` stores uploaded source videos, annotated outputs, tracking logs, and JSON results.

The backend processes one job at a time to isolate ByteTrack state and avoid concurrently using the same accelerator. Job metadata is held in memory and is cleared when the API process restarts; generated files remain under the output directory.

## Prerequisites

- Python 3.10-3.13 with the dependencies in the repository root `requirements.txt` (the pinned PyTorch version does not support every newer Python release).
- Node.js and npm.
- The repository weights `models/deepfish_multi_m.pt` and/or `models/f4k_single_m.pt`.

The DeepFish model provides multiple model classes. The F4K model is single-class fish detection; its `Fish` label is not a species-level identification.

## Install

From the repository root:

```powershell
python -m pip install -r requirements.txt
python -m pip install -r aquavision-ai\backend\requirements.txt
```

In another terminal:

```powershell
Set-Location aquavision-ai\frontend
npm install
```

## Start the application

Start the backend from `aquavision-ai\backend`:

```powershell
Set-Location aquavision-ai\backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend from `aquavision-ai\frontend`:

```powershell
Set-Location aquavision-ai\frontend
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api` requests to the FastAPI server on port 8000.

## Use

1. Open **Video intelligence**, select one of the available pretrained weights, and upload a supported video (MP4, MOV, AVI, MKV, or WebM; maximum 500 MB).
2. Follow the queued/processing status and frame progress.
3. Review the annotated video and track summaries when processing completes.
4. Explore model-label counts and confidence/frame statistics on the other pages.
5. Download JSON, CSV, or PDF output from **Reports & evaluation**.

Counts are unique ByteTrack IDs within each video, not guaranteed counts of distinct biological individuals. IDs can split after longer interruptions or occlusions. Species counts reflect model output labels; a single-class model cannot identify species. Frame-level fish counts count tracked detections in each frame. Confidence summaries are based on tracked detections only.

Evaluation metrics are shown as unavailable unless valid ground-truth annotations are associated with a processed video. No ground-truth upload or evaluation endpoint is currently provided by the web application. The repository's offline F4K tracking evaluator remains in `src/tracker/evaluate_f4k.py`.

## API

The API is served under `/api/v1`:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | API health |
| `GET` | `/models` | Available pretrained model files |
| `POST` | `/jobs` | Validate and upload a video, then queue processing (`file` and optional `model` multipart fields) |
| `GET` | `/jobs` | List jobs in the current API process |
| `GET` | `/jobs/{job_id}` | Retrieve job status and progress |
| `GET` | `/jobs/{job_id}/results` | Retrieve frame, track, and summary results |
| `GET` | `/jobs/{job_id}/species` | Retrieve per-track model-label counts |
| `GET` | `/jobs/{job_id}/video` | Stream the annotated MP4 |
| `GET` | `/jobs/{job_id}/reports/{json\|csv\|pdf}` | Download a generated report; CSV starts with a timestamped summary row followed by detections |
| `GET` | `/analytics` | Aggregate completed-job inference statistics |

Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

## Original CLI

The web application does not replace the original command-line interface. From the repository root, continue to use:

```powershell
python src\main.py --source "path\to\video.mp4" --mode standard
```

See the root `README.md` and `src/object_detector/README.md` for the original pipeline and model-development documentation.
