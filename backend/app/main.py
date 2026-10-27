from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes import router as api_router
from app.core.config import get_settings
from app.core.logging import setup_logging, logger
from app.clients.elexon import get_elexon_client, ElexonApiError


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(debug=settings.DEBUG)
    logger.info(f"Starting {settings.APP_NAME} in {settings.ENV} environment...")
    yield
    logger.info("Shutting down WindIntel API and closing HTTP connections...")
    client = get_elexon_client()
    await client.close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="WindIntel API",
        description="UK Wind Forecast Intelligence Platform — Day-Ahead Uncertainty & Outturn Analytics",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json"
    )

    # CORS Configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Custom Exception Handlers
    @app.exception_handler(ElexonApiError)
    async def elexon_api_exception_handler(request: Request, exc: ElexonApiError):
        logger.error(f"ElexonApiError on {request.url.path}: {exc.message}")
        return JSONResponse(
            status_code=exc.status_code or 502,
            content={
                "error": "UpstreamServiceError",
                "message": exc.message,
                "details": exc.details
            }
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception(f"Unhandled exception on {request.url.path}: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "InternalServerError",
                "message": "An unexpected error occurred while processing the request."
            }
        )

    app.include_router(api_router)
    return app


app = create_app()
