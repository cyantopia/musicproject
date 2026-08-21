import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}

app = FastAPI(title="StageReady OMR API", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/omr")
async def recognize_score(file: UploadFile = File(...)) -> Response:
    suffix = ALLOWED_TYPES.get(file.content_type or "")
    if not suffix:
        raise HTTPException(status_code=415, detail="Upload a PNG or JPEG score image.")

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Score image must be 15 MB or smaller.")

    with tempfile.TemporaryDirectory(prefix="stageready-omr-") as temp_dir:
        input_path = Path(temp_dir) / f"score{suffix}"
        input_path.write_bytes(contents)
        try:
            result = subprocess.run(
                ["homr", str(input_path)],
                cwd=temp_dir,
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
        except subprocess.TimeoutExpired as error:
            raise HTTPException(status_code=504, detail="Music recognition timed out.") from error

        candidates = list(Path(temp_dir).glob("*.musicxml")) + list(Path(temp_dir).glob("*.xml"))
        if result.returncode != 0 or not candidates:
            detail = result.stderr.strip()[-1200:] or "HOMR could not recognize this score."
            raise HTTPException(status_code=422, detail=detail)

        music_xml = candidates[0].read_text(encoding="utf-8")
        return Response(content=music_xml, media_type="application/vnd.recordare.musicxml+xml")
