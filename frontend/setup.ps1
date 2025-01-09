# Create base directories
New-Item -ItemType Directory -Force -Path "src"
New-Item -ItemType Directory -Force -Path "src/components"
New-Item -ItemType Directory -Force -Path "src/store"
New-Item -ItemType Directory -Force -Path "src/services"
New-Item -ItemType Directory -Force -Path "src/styles"
New-Item -ItemType Directory -Force -Path "src/utils"

# Create component directories
New-Item -ItemType Directory -Force -Path "src/components/auth/LoginForm"
New-Item -ItemType Directory -Force -Path "src/components/auth/SignupForm"
New-Item -ItemType Directory -Force -Path "src/components/auth/ForgotPassword"

New-Item -ItemType Directory -Force -Path "src/components/common/Button"
New-Item -ItemType Directory -Force -Path "src/components/common/Input"
New-Item -ItemType Directory -Force -Path "src/components/common/Modal"

New-Item -ItemType Directory -Force -Path "src/components/layout/Sidebar"
New-Item -ItemType Directory -Force -Path "src/components/layout/Header"

New-Item -ItemType Directory -Force -Path "src/components/chat/MessageList"
New-Item -ItemType Directory -Force -Path "src/components/chat/MessageInput"
New-Item -ItemType Directory -Force -Path "src/components/chat/Channel"

New-Item -ItemType Directory -Force -Path "src/components/users/UserList"
New-Item -ItemType Directory -Force -Path "src/components/users/UserStatus"

# Create store directories
New-Item -ItemType Directory -Force -Path "src/store/auth"
New-Item -ItemType Directory -Force -Path "src/store/channels"
New-Item -ItemType Directory -Force -Path "src/store/messages"
New-Item -ItemType Directory -Force -Path "src/store/users"

# Create service directories
New-Item -ItemType Directory -Force -Path "src/services/api"
New-Item -ItemType Directory -Force -Path "src/services/websocket"

# Create style directories
New-Item -ItemType Directory -Force -Path "src/styles/themes"
New-Item -ItemType Directory -Force -Path "src/styles/global" 