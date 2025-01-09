# Sermo Frontend

A retro-styled chat application frontend inspired by IRC clients and early instant messaging systems of the 1990s.

## Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── auth/           # Authentication components
│   │   ├── common/         # Reusable UI components
│   │   ├── layout/         # Layout components
│   │   ├── chat/           # Chat-related components
│   │   └── users/          # User-related components
│   ├── store/              # Redux store configuration
│   ├── services/           # API and WebSocket services
│   ├── styles/             # Global styles and themes
│   └── utils/              # Utility functions
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

## Components

### Authentication Components
- `LoginForm`: User login interface with retro styling
- `SignupForm`: New user registration
- `ForgotPassword`: Password recovery flow

### Common Components
- `Button`: Retro-styled button component
- `Input`: Text input with classic terminal styling
- `Modal`: DOS-style modal windows

### Layout Components
- `Sidebar`: Channel list and navigation
- `Header`: Main application header with user controls

### Chat Components
- `MessageList`: Displays chat messages
- `MessageInput`: Message composition area
- `Channel`: Channel view and management

### User Components
- `UserList`: Online users display
- `UserStatus`: User presence indicator

## Styling

The application uses a retro-inspired design with:
- Monospace fonts
- Terminal-style colors
- ASCII art elements
- DOS-like window frames
- Beveled edges

## State Management

Redux is used for state management with the following stores:
- `auth`: User authentication state
- `channels`: Channel management
- `messages`: Chat messages
- `users`: User presence and status

## Services

- `api`: REST API service for CRUD operations
- `websocket`: Real-time communication service

## Development

- Uses TypeScript for type safety
- Follows React best practices
- Implements responsive design
- Includes unit tests 