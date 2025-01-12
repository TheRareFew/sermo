# Frontend Architecture Documentation

## Overview
A retro-styled chat application inspired by IRC clients and early instant messaging systems of the 1990s. The UI will feature classic elements like beveled edges, monospace fonts, and a color scheme reminiscent of classic terminal interfaces.

## Tech Stack
- React.js for UI components
- Redux for state management
- WebSocket for real-time communications
- Styled Components for styling
- Lodash for utility functions

## Directory Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm/
│   │   │   ├── SignupForm/
│   │   │   └── ForgotPassword/
│   │   ├── common/
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── SearchBar/
│   │   │   └── SearchResults/
│   │   ├── layout/
│   │   │   ├── MainLayout/
│   │   │   ├── Sidebar/
│   │   │   └── Header/
│   │   ├── chat/
│   │   │   ├── MessageList/
│   │   │   ├── MessageInput/
│   │   │   ├── Channel/
│   │   │   ├── DeleteMessageModal/
│   │   │   ├── MessageOptions/
│   │   │   ├── MessageReplies/
│   │   │   └── ReplyModal/
│   │   └── users/
│   │       ├── UserList/
│   │       └── UserStatus/
│   ├── store/
│   │   ├── auth/
│   │   │   ├── currentUser
│   │   │   ├── loginStatus
│   │   │   ├── authErrors
│   │   │   └── registrationStatus
│   │   ├── channels/
│   │   ├── messages/
│   │   └── users/
│   ├── services/
│   │   ├── api/
│   │   │   ├── base.ts
│   │   │   ├── search.ts
│   │   │   └── chat.ts
│   │   ├── cache/
│   │   │   └── searchCache.ts
│   │   └── websocket/
│   ├── styles/
│   │   ├── themes/
│   │   └── global/
│   └── utils/
```

## Core Components

### Authentication Components
1. **LoginPage**
   - Retro-styled login form
   - Username/email input
   - Password input with toggle visibility
   - "Remember me" checkbox
   - Error messaging
   - Link to signup page
   - ASCII art logo

2. **SignupPage**
   - User registration form
   - Email validation
   - Password strength indicator
   - Username availability check
   - Terms of service checkbox
   - Welcome ASCII art

3. **ForgotPassword**
   - Password recovery flow
   - Email verification
   - Security questions
   - Reset confirmation

### Layout Components
1. **MainLayout**
   - Classic three-column layout
   - Channels list (left)
   - Message area (center)
   - Users list (right)

2. **Header**
   - User status controls
   - Search bar
   - Application menu

### Chat Components
1. **ChannelList**
   - List of available channels
   - Channel creation modal
   - Unread indicators
   - Direct message list

2. **MessageArea**
   - Message history display
   - File attachments
   - Reactions
   - Thread view
   - Typing indicators

3. **MessageInput**
   - Text input
   - File upload
   - Emoji picker
   - Message formatting

### User Components
1. **UserList**
   - Online/offline status
   - User presence indicators
   - User profile modals

2. **UserStatus**
   - Status selector
   - Custom status message
   - Profile picture

### Search Components
1. **SearchBar**
   - Retro-styled search input
   - Debounced search functionality
   - Error handling and display
   - Click outside handling
   - Keyboard navigation (Escape to clear)
   - Real-time search feedback

2. **SearchResults**
   - Categorized results display (Messages, Channels, Files)
   - Section-based organization
   - Interactive result items
   - Navigation to selected items
   - Smooth scrolling to messages
   - Result highlighting
   - Empty state handling

### Cache Services
1. **SearchCache**
   - In-memory caching for search results
   - TTL-based cache invalidation
   - Maximum entry limit
   - Automatic cleanup of expired entries
   - Performance optimization

## State Management

### Store Structure
```
store/
├── auth/
│   ├── currentUser
│   ├── loginStatus
│   ├── authErrors
│   └── registrationStatus
├── channels/
│   ├── currentChannel
│   └── channelList
├── messages/
│   ├── messagesByChannel
│   └── threads
├── users/
│   ├── currentUser
│   ├── onlineUsers
│   └── userPresence
└── ui/
    ├── activeModals
    └── theme
```

## WebSocket Integration
- Real-time message updates
- User presence tracking
- Typing indicators
- Message reactions

## API Integration
- RESTful endpoints for CRUD operations
- File uploads
- Search functionality
- User management

### Authentication Endpoints
- Login endpoint integration
- Registration flow
- Password reset
- Token management
- Session handling
- Refresh token rotation

## Retro UI Elements

### Authentication Styling
1. **Login/Signup Forms**
   - ASCII art borders
   - Retro input fields with blinking cursors
   - "Loading..." animations using ASCII spinners
   - Error messages in classic console style
   - Success messages with ASCII checkmarks

2. **Authentication Modals**
   - DOS-style dialog boxes
   - Keyboard-focused navigation
   - Tab-index optimization
   - Focus trapping

### Visual Style
1. **Colors**
   - Primary: #00FF00 (Terminal green)
   - Background: #000000
   - Accent: #0000FF (Classic blue)
   - Text: #33FF33

2. **Typography**
   - Primary: "DOS VGA 437" or similar
   - Monospace fallbacks
   - ASCII art for decorative elements

3. **UI Elements**
   - Beveled borders
   - Pixel-perfect corners
   - DOS-style window frames
   - Scanline effects (optional)

### Interactive Elements
1. **Buttons**
   - 3D beveled appearance
   - Pressed state animation
   - Keyboard shortcuts

2. **Input Fields**
   - Inset appearance
   - Blinking cursor
   - Command-line style

3. **Modals**
   - DOS window style
   - Draggable headers
   - ASCII art borders

## Responsive Design
- Desktop-first approach
- Collapsible sidebars
- Touch-friendly controls
- Maintains retro aesthetic across devices

## Performance Considerations
- Virtual scrolling for message lists
- Lazy loading for images
- Message pagination
- WebSocket connection management

## Accessibility
- Keyboard navigation
- Screen reader support
- High contrast mode
- ARIA labels

## Error Handling
- Connection status indicators
- Retry mechanisms
- Offline mode support
- Error messages in retro style

## Future Considerations
- Theme customization
- Plugin system
- Custom emoji support
- Voice chat integration
- Screen sharing

## Search Integration
- Real-time search across messages, channels, and files
- Debounced API calls for performance
- Client-side caching
- Result categorization
- Navigation integration
- Error handling and feedback
- Empty state management

### Search Endpoints
- `/api/search/messages` - Search message content
- `/api/search/channels` - Search channel names and descriptions
- `/api/search/files` - Search file names and types

### Search Features
1. **Message Search**
   - Content-based search
   - Channel context display
   - Timestamp information
   - Navigation to message
   - Highlight selected message

2. **Channel Search**
   - Name and description search
   - Member count display
   - Direct message vs public channel indicators
   - One-click channel switching

3. **File Search**
   - Filename and type search
   - Channel context
   - Creation date
   - File preview (planned)

This architecture provides a solid foundation for building a retro-styled chat application while maintaining modern development practices and performance considerations.