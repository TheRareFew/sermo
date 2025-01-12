from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.v1 import users, channels, messages, files, reactions, search, websockets
from .auth.router import router as auth_router
from .database import init_db
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(title="Chat API", version="1.0.0")

# Initialize database tables
init_db()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(channels.router, prefix="/api/channels", tags=["channels"])
app.include_router(messages.channel_router, prefix="/api/channels", tags=["messages"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(reactions.router, prefix="/api/messages", tags=["reactions"])
app.include_router(search.router, prefix="/api/search", tags=["search"])

# Mount WebSocket router without prefix to avoid path duplication
logger.debug("Mounting WebSocket router")
app.include_router(websockets.router, tags=["websockets"])

@app.get("/")
async def root():
    return {"message": "Welcome to Chat API"} 