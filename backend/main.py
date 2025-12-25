"""Product Intelligence Backend API - FastAPI Application."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.core.config import API_V1_PREFIX, PROJECT_NAME, CORS_ORIGINS
from backend.core.database import init_db
from backend.api.routes import api_router

FRONTEND_BUILD_DIR = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    print(f"Starting {PROJECT_NAME} API...")
    init_db()
    print("Database initialized")
    print(f"Frontend build dir: {FRONTEND_BUILD_DIR}")
    print(f"Frontend build exists: {FRONTEND_BUILD_DIR.exists()}")
    yield
    print("Shutting down...")


app = FastAPI(
    title=PROJECT_NAME,
    description="Contract extraction and intelligence API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

app.include_router(api_router, prefix=API_V1_PREFIX)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if FRONTEND_BUILD_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_BUILD_DIR / "assets"), name="static-assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Serve the SPA for all non-API routes."""
        if full_path.startswith("api/"):
            return {"detail": "Not Found"}
        
        file_path = FRONTEND_BUILD_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        index_path = FRONTEND_BUILD_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"detail": "Frontend not built"}
else:
    @app.get("/")
    async def root():
        """Root endpoint when frontend not built."""
        return {
            "name": PROJECT_NAME,
            "version": "0.1.0",
            "docs": "/docs",
            "api": API_V1_PREFIX,
            "note": "Frontend not built. Run 'cd frontend && npm run build' first.",
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=5000,
        reload=True,
    )
