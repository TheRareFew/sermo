# API v1 package initialization
from .users import router as users_router
from .channels import router as channels_router
from .messages import router as messages_router, channel_router as messages_channel_router
from .files import router as files_router
from .reactions import router as reactions_router
from .search import router as search_router
from .websockets import router as websockets_router
from .ai_features import router as ai_features_router
from .voice import router as voice_router

# Export all routers
__all__ = [
    'users',
    'channels',
    'messages',
    'files',
    'reactions',
    'search',
    'websockets',
    'ai_features',
    'voice'
]

# Create router objects
class RouterContainer:
    def __init__(self, router):
        self.router = router

users = RouterContainer(users_router)
channels = RouterContainer(channels_router)
messages = RouterContainer(messages_router)
messages.channel_router = messages_channel_router
files = RouterContainer(files_router)
reactions = RouterContainer(reactions_router)
search = RouterContainer(search_router)
websockets = RouterContainer(websockets_router)
ai_features = RouterContainer(ai_features_router)
voice = RouterContainer(voice_router) 