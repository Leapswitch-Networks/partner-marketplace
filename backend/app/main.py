from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api import admin, auth, candidate, category

app = FastAPI(title="Test Platform API", version="1.0.0")

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(candidate.router, prefix="/api")
app.include_router(category.router, prefix="/api")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
