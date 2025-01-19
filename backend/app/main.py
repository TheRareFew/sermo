from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from .api.v1 import users, channels, messages, files, reactions, search, websockets, ai_features
from .auth.router import router as auth_router
from .database import init_db
import logging
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # Default level for all loggers
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Set specific levels for different loggers
app_logger = logging.getLogger(__name__)
app_logger.setLevel(logging.DEBUG)  # More detailed for our app code

# Set third-party loggers to be less verbose
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

app = FastAPI(title="Chat API", version="1.0.0")

# Initialize database tables
# Only create test data if we're in development mode
is_development = os.getenv("ENVIRONMENT", "development").lower() == "development"
init_db(create_test_data=is_development)

# Add trusted host middleware in production
if not is_development:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["your_domain.com", "www.your_domain.com"]
    )
    # Uncomment to enforce HTTPS redirect at application level
    # app.add_middleware(HTTPSRedirectMiddleware)

# Configure CORS with secure origins in production
allowed_origins = ["http://localhost:3000", "http://localhost:5173"]
if not is_development:
    allowed_origins.extend(["https://your_domain.com", "https://www.your_domain.com"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
app.include_router(ai_features.router, prefix="/api/ai", tags=["ai"])

# Mount WebSocket router without prefix to avoid path duplication
app_logger.debug("Mounting WebSocket router")
app.include_router(websockets.router, tags=["websockets"])

@app.get("/")
async def root():
    return {"message": "Welcome to Chat API"} 