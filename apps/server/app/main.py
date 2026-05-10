from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import pool
from app.routers import admin, auth, rewrite, usage


@asynccontextmanager
async def lifespan(application: FastAPI):
    yield
    pool.close()


app = FastAPI(title="Gmasti API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=settings.allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(rewrite.router)
app.include_router(usage.router)


@app.get("/health")
def health():
    return {"status": "we cooking"}

