import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from app.api.routes import router as api_router
from app.core.config import ALLOWED_ORIGINS, API_PREFIX, PROJECT_NAME, VERSION


app = FastAPI(title=PROJECT_NAME, version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=API_PREFIX)


@app.get("/")
async def root():
    return {"name": PROJECT_NAME, "status": "ready"}
