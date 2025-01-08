from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.v1 import users, channels, messages, files, reactions, search, websockets
from .auth import router as auth_router

app = FastAPI(title="Chat API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(channels.router, prefix="/api/channels", tags=["channels"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(reactions.router, prefix="/api/messages", tags=["reactions"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(websockets.router, prefix="/ws", tags=["websockets"])

@app.get("/")
async def root():
    return {"message": "Welcome to Chat API"} 