import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import Message from '../components/chat/Message';
import { theme } from '../styles/themes/default';
import { addReaction, removeReaction } from '../services/api/reactions';
import { ChatMessageProps } from '../components/chat/Message';
import '@testing-library/jest-dom';
import '../setupTests';

// Mock the API calls
jest.mock('../services/api/reactions');

// Mock emoji-mart
jest.mock('@emoji-mart/react', () => ({
  __esModule: true,
  default: () => <div role="dialog">😄</div>,
}));

const mockStore = configureStore([thunk]);

describe('Message Reactions', () => {
  const mockMessage: ChatMessageProps = {
    id: '1',
    content: 'Test message',
    sender: 'testuser',
    timestamp: new Date().toISOString(),
    userId: 'user1',
    currentUserId: 'user1',
    reactions: [
      {
        id: '1',
        messageId: '1',
        userId: 'user2',
        emoji: '👍',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        messageId: '1',
        userId: 'user3',
        emoji: '👍',
        createdAt: new Date().toISOString(),
      },
    ],
    onDelete: jest.fn(),
    replyCount: 0,
    isExpanded: false,
    onToggleReplies: jest.fn(),
    onReply: jest.fn(),
    onReactionAdd: jest.fn(),
    onReactionRemove: jest.fn(),
  };

  const store = mockStore({
    auth: {
      user: { id: 'user1', username: 'testuser' },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays reactions with correct count', () => {
    render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <Message {...mockMessage} />
        </ThemeProvider>
      </Provider>
    );

    const reactionBadge = screen.getByText('👍');
    const reactionCount = screen.getByText('2');
    
    expect(reactionBadge).toBeInTheDocument();
    expect(reactionCount).toBeInTheDocument();
  });

  it('adds a reaction when clicking the emoji button', async () => {
    (addReaction as jest.Mock).mockResolvedValue({
      id: '3',
      messageId: '1',
      userId: 'user1',
      emoji: '😄',
      createdAt: new Date().toISOString(),
    });

    render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <Message {...mockMessage} />
        </ThemeProvider>
      </Provider>
    );

    // Open emoji picker
    const emojiButton = screen.getByTitle('Add reaction');
    fireEvent.click(emojiButton);

    // Select an emoji (this will depend on your emoji picker implementation)
    const emojiPicker = screen.getByRole('dialog');
    expect(emojiPicker).toBeInTheDocument();

    // Mock selecting an emoji
    const mockEmojiSelect = { native: '😄' };
    fireEvent.click(screen.getByText('😄'));

    await waitFor(() => {
      expect(mockMessage.onReactionAdd).toHaveBeenCalledWith('😄');
    });
  });

  it('removes a reaction when clicking an existing reaction', async () => {
    (removeReaction as jest.Mock).mockResolvedValue(undefined);

    render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <Message {...mockMessage} />
        </ThemeProvider>
      </Provider>
    );

    const reactionBadge = screen.getByText('👍');
    fireEvent.click(reactionBadge);

    await waitFor(() => {
      expect(mockMessage.onReactionRemove).toHaveBeenCalledWith('👍');
    });
  });

  it('groups identical reactions and shows total count', () => {
    const messageWithDuplicateReactions: ChatMessageProps = {
      ...mockMessage,
      reactions: [
        ...mockMessage.reactions,
        {
          id: '3',
          messageId: '1',
          userId: 'user4',
          emoji: '👍',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <Message {...messageWithDuplicateReactions} />
        </ThemeProvider>
      </Provider>
    );

    const reactionCount = screen.getByText('3');
    expect(reactionCount).toBeInTheDocument();
  });
}); 