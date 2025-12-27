"""API routes."""

from fastapi import APIRouter

from backend.api.routes import contracts, extractions, models, exports, members, authorities, prompts

api_router = APIRouter()

api_router.include_router(contracts.router, prefix="/contracts", tags=["contracts"])
api_router.include_router(extractions.router, prefix="/extractions", tags=["extractions"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])
api_router.include_router(members.router, prefix="/members", tags=["members"])
api_router.include_router(authorities.router, prefix="/authorities", tags=["authorities"])
api_router.include_router(prompts.router, prefix="/prompts", tags=["prompts"])
