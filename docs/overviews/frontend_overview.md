# Project Frontend Overview

## Table of Contents

- [App Structure](#app-structure)
- [Components](#components)
  - [Chat Components](#chat-components)
  - [Layout Components](#layout-components)
  - [Authentication Components](#authentication-components)
  - [Common Components](#common-components)
- [Services](#services)
  - [API Services](#api-services)
  - [WebSocket Service](#websocket-service)
  - [WebRTC and Voice Services](#webrtc-and-voice-services)
- [State Management](#state-management)
- [Backend API Calls](#backend-api-calls)
- [Progress](#progress)

## App Structure

The frontend is built using **React** and **TypeScript**, utilizing **Redux** for state management. The main entry point of the application is `src/index.tsx`, which renders the `App` component within a `Router` and a Redux `Provider`.

**Entry Point:** `src/index.tsx`

[CODE START]
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import { store } from './store';
import App from './App';
import './styles/global/index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <Router>
        <App />
      </Router>
    </Provider>
  </React.StrictMode>
);
[CODE END]

## Components

### Chat Components

#### MessageList

**Path:** `src/components/chat/MessageList/index.tsx`

The `MessageList` component displays chat messages within a channel. It handles message loading, infinite scrolling, and navigation to specific messages. It interacts with the backend to fetch messages, load older messages, and navigate to a target message.

**Backend Calls:**

- `getChannelMessages(channelId, limit, offset)` - Fetches messages for a given channel.
- `getMessagePosition(channelId, messageId)` - Retrieves the position of a specific message in the channel.
- `createReply(messageId, content)` - Creates a reply to a message.
- `addReaction(messageId, emoji)` - Adds a reaction to a message.
- `removeReaction(messageId, emoji)` - Removes a reaction from a message.

**Example:**
[CODE START]
// Load latest messages
const latestMessages = await getChannelMessages(channelId, 50, 0);
[CODE END]

#### MessageInput

**Path:** `src/components/chat/MessageInput/index.tsx`

Handles user input for sending messages, attachments, and reactions. It manages message composition, file uploads, and interacts with AI services for automated responses.

**Backend Calls:**

- `sendMessage(channelId, content)` - Sends a new message.
- `uploadFile(channelId, file)` - Uploads a file to the server.
- `updateFileMessage(messageId, fileId)` - Associates an uploaded file with a message.
- `sendAiMessage(content)` - Sends a message to the AI service for processing.

**Example:**
[CODE START]
// Send text message
const newMessage = await sendMessage(channelId, { content });
[CODE END]

#### CreateChannelModal

**Path:** `src/components/chat/CreateChannelModal/index.tsx`

Allows users to create new channels, both public and private, with options for voice channels and member selection.

**Backend Calls:**

- `createChannel(channelData)` - Creates a new channel with specified parameters.

**Example:**
[CODE START]
// Create a new channel
const newChannel = await createChannel({
  name: trimmedName,
  description: description.trim() || undefined,
  is_public: isPublic,
  is_vc: isVc,
  member_ids: !isPublic ? [currentUser!.id, ...selectedMembers] : undefined
});
[CODE END]

#### ReplyModal

**Path:** `src/components/chat/ReplyModal/index.tsx`

Provides a modal interface for replying to messages.

**Backend Calls:**

- Utilizes `createReply` indirectly through handlers.

#### FilePreview

**Path:** `src/components/chat/FilePreview/index.tsx`

Displays file attachments within messages, including images, videos, and other file types.

**Backend Calls:**

- Fetches file data from the server using the provided file paths.

### Layout Components

#### MainLayout

**Path:** `src/components/layout/MainLayout/index.tsx`

The main layout component that encompasses the chat area, header, and sidebar. It initializes data, handles channel switching, and manages WebSocket connections for real-time updates.

**Backend Calls:**

- `getChannels()` - Retrieves the list of available channels.
- `getChannelUsers(channelId)` - Retrieves users belonging to a channel.
- `getChannelMessages(channelId)` - Fetches messages for the active channel.
- `joinChannel(channelId)` - Adds the user to a channel.
- `searchAll(query)` - Performs search queries across messages and files.

**Example:**
[CODE START]
// Fetch channels on load
const channels = await getChannels();
[CODE END]

#### Sidebar

**Path:** `src/components/layout/MainLayout/Sidebar/index.tsx`

Displays the navigation sidebar with channels and direct messages. Handles channel selection.

**Backend Calls:**

- No direct backend calls; interacts with the state and dispatches actions.

#### ChannelSettings

**Path:** `src/components/chat/ChannelSettings/index.tsx`

Allows users to manage channel settings, including updating descriptions, toggling privacy, managing members, and deleting channels.

**Backend Calls:**

- `updateChannel(channelId, updates)` - Updates channel information.
- `deleteChannel(channelId)` - Deletes a channel.
- `removeChannelMember(channelId, userId)` - Removes a member from a channel.
- `addChannelMembers(channelId, memberIds)` - Adds members to a channel.

**Example:**
[CODE START]
// Update channel details
await updateChannel(channelId, {
  description,
  is_public: isPublic
});
[CODE END]

### Authentication Components

#### LoginForm

**Path:** `src/components/auth/LoginForm/index.tsx`

Handles user authentication by collecting username and password inputs and submitting them to the backend.

**Backend Calls:**

- `login(credentials)` - Authenticates the user and retrieves a token.

**Example:**
[CODE START]
// Submit login form
const response = await login({ username, password });
[CODE END]

### Common Components

#### Modal

**Path:** `src/components/common/Modal/index.tsx`

A reusable modal component used throughout the application.

**No direct backend calls.**

#### Input

**Path:** `src/components/common/Input/index.tsx`

A styled input component.

**No direct backend calls.**

#### Select

**Path:** `src/components/common/Select/index.tsx`

A custom select component, often used for member selection in forms.

**No direct backend calls.**

#### SearchBar and SearchResults

**Paths:**

- `src/components/common/SearchBar/index.tsx`
- `src/components/common/SearchResults/index.tsx`

Handle search input and display search results.

**Backend Calls:**

- `searchAll(query)` - Initiated from `MainLayout` component.

### Voice Components

#### VoiceChannel

**Path:** `src/components/voice/VoiceChannel/index.tsx`

Manages voice communication within channels using WebRTC.

**Backend Calls:**

- Interacts with signaling server through WebSocket for WebRTC connection setup.

**Example:**
[CODE START]
// Handle joining voice channel
await voiceService.joinChannel(channelId);
[CODE END]

## Services

### API Services

#### Chat API

**Path:** `src/services/api/chat.ts`

Contains functions for chat-related backend interactions.

- `getChannelMessages`
- `createMessage`
- `createChannel`
- `updateChannel`
- `deleteChannel`
- `getChannelUsers`
- `addChannelMembers`
- `removeChannelMember`
- `createReply`

**Example:**
[CODE START]
// Retrieve messages from the backend
export const getChannelMessages = async (channelId: string, limit = 50, offset = 0) => {
  const response = await apiClient.get(`/channels/${channelId}/messages`, { params: { limit, offset } });
  return response.data;
};
[CODE END]

#### Reactions API

**Path:** `src/services/api/reactions.ts`

Handles message reactions.

- `addReaction`
- `removeReaction`

#### Files API

**Path:** `src/services/api/files.ts`

Manages file uploads and retrievals.

- `uploadFile`
- `getMessageFiles`
- `updateFileMessage`

#### Auth API

**Path:** `src/services/api/auth.ts`

Manages authentication and user-related actions.

- `login`
- `logout`

#### AI API

**Path:** `src/services/api/ai.ts`

Handles interactions with the AI service.

- `sendAiMessage`

### WebSocket Service

**Path:** `src/services/websocket.ts`

Manages real-time communication with the backend via WebSocket, handling events such as new messages, updates, and signaling for WebRTC.

**Example:**
[CODE START]
// Initialize WebSocket connection
const socket = new WebSocket(`${WS_URL}?token=${token}`);
[CODE END]

### WebRTC and Voice Services

#### WebRTC Service

**Path:** `src/services/webrtc/index.ts`

Manages peer-to-peer connections for voice communication within voice channels.

**Example:**
[CODE START]
// Handle incoming offer
private async handleOffer(desc: RTCSessionDescriptionInit, fromUserId: string) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  // Send answer back to the peer
}
[CODE END]

#### Voice Service

**Path:** `src/services/voice/index.ts`

Handles audio processing, voice data transmission, and playback.

**Example:**
[CODE START]
// Setup audio processing for voice activity detection
private async setupAudioProcessing(): Promise<void> {
  this.audioAnalyser = this.audioContext.createAnalyser();
}
[CODE END]

## State Management

The application uses **Redux** for state management, with slices for different parts of the state.

**Slices:**

- `authSlice` - Authentication state.
- `chatSlice` - Channels, users, and chat-related state.
- `messagesSlice` - Messages for each channel.
- `voiceSlice` - Voice channel state.

**Example:**
[CODE START]
// Update messages state
dispatch(setMessages({
  channelId,
  messages: transformedMessages
}));
[CODE END]

## Backend API Calls

Below is a summary of backend API calls made throughout the frontend:

- **Authentication**
  - `login(credentials)` - `LoginForm`

- **Channels**
  - `getChannels()` - `MainLayout`
  - `createChannel(channelData)` - `CreateChannelModal`
  - `updateChannel(channelId, updates)` - `ChannelSettings`
  - `deleteChannel(channelId)` - `ChannelSettings`
  - `getChannelUsers(channelId)` - `MainLayout`, `ChannelSettings`
  - `addChannelMembers(channelId, memberIds)` - `ChannelSettings`
  - `removeChannelMember(channelId, userId)` - `ChannelSettings`
  - `joinChannel(channelId)` - `MainLayout`

- **Messages**
  - `getChannelMessages(channelId, limit, offset)` - `MessageList`, `MainLayout`, `MessageInput`
  - `sendMessage(channelId, content)` - `MessageInput`
  - `createReply(messageId, content)` - `MessageList`
  - `getMessagePosition(channelId, messageId)` - `MessageList`

- **Reactions**
  - `addReaction(messageId, emoji)` - `MessageList`
  - `removeReaction(messageId, emoji)` - `MessageList`

- **Files**
  - `uploadFile(channelId, file)` - `MessageInput`
  - `getMessageFiles(messageId)` - `Message`

- **Search**
  - `searchAll(query)` - `MainLayout`

- **AI Service**
  - `sendAiMessage(content)` - `MessageInput`


---
