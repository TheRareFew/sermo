'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Message, Channel, UserSettings } from '../types'
import Settings from './Settings'
import MessageActions from './MessageActions'
import UserProfile from './UserProfile'
import { WebSocketManager } from '@/utils/WebSocketManager'
import { updateErrorHandlerSettings } from '@/utils/errorHandler'

interface ChatWindowProps {
  currentUser: string
  channels: Channel[]
  directMessages: { [key: string]: Message[] }
}

// Default settings
const DEFAULT_SETTINGS: UserSettings = {
  showSystemMessages: true,
  displayName: '',
  userStatus: 'online',
  developerMode: false
}

// Helper functions for settings persistence
const loadSettings = (currentUser: string): UserSettings => {
  if (typeof window === 'undefined') {
    return {
      ...DEFAULT_SETTINGS,
      displayName: currentUser
    }
  }
  
  const saved = localStorage.getItem('userSettings')
  if (!saved) {
    return {
      ...DEFAULT_SETTINGS,
      displayName: currentUser
    }
  }

  try {
    const parsedSettings = JSON.parse(saved)
    return {
      ...DEFAULT_SETTINGS,
      ...parsedSettings,
      displayName: parsedSettings.displayName || currentUser
    }
  } catch (e) {
    console.error('Failed to parse saved settings:', e)
    return {
      ...DEFAULT_SETTINGS,
      displayName: currentUser
    }
  }
}

const saveSettings = (settings: UserSettings) => {
  localStorage.setItem('userSettings', JSON.stringify(settings))
}

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000';

// Add a helper function for generating unique IDs
const generateUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

export default function ChatWindow({ currentUser, channels, directMessages }: ChatWindowProps) {
  const [activeChannel, setActiveChannel] = useState<string | null>(() => channels[0]?.id || null)
  const [activeDM, setActiveDM] = useState<string | null>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<UserSettings>(() => ({
    showSystemMessages: true,
    displayName: currentUser,
    userStatus: 'online',
    developerMode: false
  }))
  const [messageActionsState, setMessageActionsState] = useState<{
    isOpen: boolean
    messageId: string | null
    accountName: string | null
    position: { x: number, y: number }
  }>({
    isOpen: false,
    messageId: null,
    accountName: null,
    position: { x: 0, y: 0 }
  })
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [wsManager, setWsManager] = useState<WebSocketManager | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [errorDetails, setErrorDetails] = useState<{
    message: string;
    stack?: string;
    showStack: boolean;
  } | null>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [shouldReconnect, setShouldReconnect] = useState(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [pageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Load saved settings on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('userSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings(prev => ({
          ...prev,
          ...parsed
        }))
      } catch (e) {
        console.error('Failed to parse saved settings:', e)
      }
    }
  }, []) // Only run on mount

  // Update settings when currentUser changes
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      displayName: prev.displayName || currentUser
    }))
  }, [currentUser])

  // Load all messages initially but only display the most recent ones
  useEffect(() => {
    if (!activeChannel) return;
    
    const loadMessages = async () => {
      try {
        const url = new URL(`http://localhost:8000/api/messages/channel/${activeChannel}`);
        const response = await fetch(url.toString());
        
        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.status}`);
        }
        
        const messages = await response.json();
        setAllMessages(messages);
        
        // Initially show only the most recent page of messages
        const startIdx = Math.max(0, messages.length - pageSize);
        const initialMessages = messages.slice(startIdx);
        
        // Set states in sequence
        setVisibleMessages(initialMessages);
        setCurrentPage(Math.floor(messages.length / pageSize));
        
        // Force scroll to bottom after state updates
        requestAnimationFrame(() => {
          if (messageContainerRef.current) {
            const container = messageContainerRef.current;
            container.scrollTop = container.scrollHeight;
          }
        });
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    // Clear messages and reset scroll before loading new ones
    setAllMessages([]);
    setVisibleMessages([]);
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = 0;
    }
    
    loadMessages();
  }, [activeChannel, pageSize]);

  // Update the scroll handler to append messages
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isNearTop = container.scrollTop < 100;
    
    // Update isNearBottom state
    const scrollPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsNearBottom(scrollPosition < 100);
    
    if (isNearTop && currentPage > 0) {
      // Calculate the previous page's messages
      const prevPage = currentPage - 1;
      const startIdx = Math.max(0, prevPage * pageSize);
      const endIdx = startIdx + pageSize;
      
      // Store current scroll position
      const currentScrollHeight = container.scrollHeight;
      
      // Append older messages to existing ones instead of replacing
      const olderMessages = allMessages.slice(startIdx, endIdx);
      setVisibleMessages(prev => [...olderMessages, ...prev]);
      setCurrentPage(prevPage);
      
      // Maintain scroll position after loading more messages
      requestAnimationFrame(() => {
        if (messageContainerRef.current) {
          const newScrollHeight = messageContainerRef.current.scrollHeight;
          const scrollDiff = newScrollHeight - currentScrollHeight;
          messageContainerRef.current.scrollTop = scrollDiff + 100; // Add buffer
        }
      });
    }
  }, [currentPage, pageSize, allMessages]);

  // Add a scroll handler for new messages
  const scrollToBottom = useCallback(() => {
    if (messageContainerRef.current && isNearBottom) {
      const container = messageContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [isNearBottom]);

  // Update the message handler with improved scroll behavior
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.action === 'delete') {
        setAllMessages(prev => prev.filter(msg => msg.id !== data.messageId));
        setVisibleMessages(prev => prev.filter(msg => msg.id !== data.messageId));
      } else if (data.content && data.sender) {
        const timestamp = new Date().toISOString();
        const newMessage: Message = {
          id: `new-${generateUniqueId()}-${timestamp}`,
          content: data.content,
          sender: data.sender,
          accountName: data.accountName || data.sender,
          timestamp: timestamp,
          type: data.type || 'message'
        };

        setAllMessages(prev => [...prev, newMessage]);
        setVisibleMessages(prev => {
          const newMessages = [...prev, newMessage];
          // Only scroll if near bottom
          if (isNearBottom) {
            setTimeout(scrollToBottom, 0);
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }, [scrollToBottom, isNearBottom]);

  // Add effect to handle scroll on visible messages change
  useEffect(() => {
    scrollToBottom();
  }, [visibleMessages, scrollToBottom]);

  // Update WebSocket effect
  useEffect(() => {
    if (!activeChannel) return;
    
    console.log('Setting up WebSocket for channel:', activeChannel);
    const wsUrl = `${BACKEND_WS_URL}/ws/channel/${encodeURIComponent(settings.displayName)}/${activeChannel}`;
    
    const wsManager = new WebSocketManager(wsUrl, {
      onMessage: handleMessage,
      onClose: () => {
        console.log('WebSocket closed');
        setConnectionStatus('disconnected');
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
      },
      onOpen: () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
      }
    });

    setWsManager(wsManager);
    setConnectionStatus('connecting');
    wsManager.connect();

    // Simple cleanup without system messages
    return () => {
      wsManager.disconnect();
      setWsManager(null);
      setConnectionStatus('disconnected');
    };
  }, [activeChannel, settings.displayName, handleMessage]);

  // Update the send message handler
  const handleSendMessage = useCallback(() => {
    if (inputMessage.trim() !== '' && wsManager?.isConnected()) {
      const newMessage = {
        id: Date.now().toString(),
        content: inputMessage,
        sender: settings.displayName,
        accountName: currentUser,
        timestamp: new Date().toISOString(),
        type: 'message'
      };
      
      wsManager.send(newMessage);
      setInputMessage('');
    }
  }, [inputMessage, wsManager, settings.displayName, currentUser]);

  // Update handleSettingChange to handle WebSocket reconnection
  const handleSettingChange = (setting: keyof UserSettings, value: any) => {
    const newSettings = {
      ...settings,
      [setting]: value
    }
    setSettings(newSettings)
    localStorage.setItem('userSettings', JSON.stringify(newSettings))

    // Force WebSocket reconnection for display name changes
    if (setting === 'displayName' && socket) {
      socket.close()
      setSocket(null)
    }
  }

  const handleDeleteMessage = async (messageId: string, messageAccountName: string) => {
    if (messageAccountName !== currentUser) return;

    try {
      // Remove message locally first
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      const response = await fetch(`http://localhost:8000/api/messages/${messageId}?account_name=${encodeURIComponent(currentUser)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      // Notify other users through websocket
      if (wsManager?.isConnected()) {
        wsManager.send({
          action: 'delete',
          messageId: messageId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      // Revert the local deletion if the server request failed
      loadMessages();
    }
  };

  const handleMessageActionsOpen = (messageId: string, accountName: string, event: React.MouseEvent) => {
    const button = event.currentTarget.getBoundingClientRect()
    const x = Math.min(button.right, window.innerWidth - 170)
    const y = Math.min(button.bottom, window.innerHeight - 100)

    setMessageActionsState({
      isOpen: true,
      messageId,
      accountName,
      position: { x, y }
    })
  }

  useEffect(() => {
    // Update error handler settings when they change
    updateErrorHandlerSettings(settings)
  }, [settings])

  return (
    <div className="flex h-screen bg-gray-900">
      <div className="w-64 bg-gray-800 text-green-400 flex flex-col">
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-xl mb-4">Channels</h2>
          {channels.map(channel => (
            <div
              key={channel.id}
              className={`cursor-pointer p-2 ${activeChannel === channel.id ? 'bg-green-400 text-black' : ''}`}
              onClick={() => { setActiveChannel(channel.id); setActiveDM(null); }}
            >
              # {channel.name}
            </div>
          ))}
          <h2 className="text-xl mt-6 mb-4">Direct Messages</h2>
          {Object.keys(directMessages).map(user => (
            <div
              key={user}
              className={`cursor-pointer p-2 ${activeDM === user ? 'bg-green-400 text-black' : ''}`}
              onClick={() => { setActiveDM(user); setActiveChannel(null); }}
            >
              @ {user}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-green-400 flex justify-between items-center">
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 text-green-400 hover:text-green-300 focus:outline-none"
            title="User Profile"
          >
            <span>👤</span>
            <div className={`w-2 h-2 rounded-full ${
              settings.userStatus === 'online' ? 'bg-green-400' :
              settings.userStatus === 'away' ? 'bg-yellow-400' :
              settings.userStatus === 'busy' ? 'bg-red-400' :
              'bg-gray-400'
            }`} />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="text-green-400 hover:text-green-300 focus:outline-none"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl text-green-400">
            {activeChannel ? `#${activeChannel}` : activeDM}
          </h2>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400' :
              connectionStatus === 'connecting' ? 'bg-yellow-400' :
              'bg-red-400'
            }`} />
            <span className="text-sm text-gray-400">
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'connecting' ? 'Connecting...' :
               'Disconnected'}
            </span>
          </div>
        </div>
        <div 
          ref={messageContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2"
          onScroll={handleScroll}
        >
          {currentPage > 0 && (
            <div className="text-center py-2">
              <button 
                className="text-green-400 hover:text-green-300"
                onClick={() => handleScroll({ currentTarget: messageContainerRef.current! } as any)}
              >
                Load older messages...
              </button>
            </div>
          )}
          {visibleMessages.map((message, index) => (
            <div 
              key={`${message.id}-${index}`}  // Use both ID and index for uniqueness
              className={`p-2 rounded relative group ${
                message.sender === 'system' || message.type === 'system'
                  ? 'bg-gray-700 text-gray-400 italic text-sm' 
                  : 'bg-gray-800'
              }`}
            >
              {message.sender === 'system' || message.type === 'system' ? (
                <div>{message.content}</div>
              ) : (
                <>
                  <span className="font-bold text-green-400">{message.sender}: </span>
                  <span className="text-gray-300">{message.content}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  {message.accountName === currentUser && (
                    <button
                      onClick={(e) => handleMessageActionsOpen(message.id, message.accountName, e)}
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 
                        text-green-400 hover:text-green-300 transition-opacity"
                    >
                      [...]
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex border-t border-green-400">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            className="flex-grow bg-black text-green-400 p-2 focus:outline-none"
          />
          <button
            onClick={handleSendMessage}
            className="bg-green-400 text-black px-4 py-2 hover:bg-green-500 focus:outline-none"
          >
            Send
          </button>
        </div>
      </div>
      <MessageActions 
        isOpen={messageActionsState.isOpen}
        onClose={() => setMessageActionsState(prev => ({ ...prev, isOpen: false }))}
        onDelete={handleDeleteMessage}
        messageId={messageActionsState.messageId || ''}
        accountName={messageActionsState.accountName || ''}
        position={messageActionsState.position}
      />
      <Settings 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingChange={handleSettingChange}
      />
      <UserProfile 
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={settings.displayName}
        status={settings.userStatus}
        onStatusChange={(status) => handleSettingChange('userStatus', status)}
        onDisplayNameChange={(name) => handleSettingChange('displayName', name)}
      />
      {settings.developerMode && errorDetails && (
        <div className="fixed bottom-4 left-4 bg-red-500 text-white rounded shadow-lg max-w-xl">
          <div className="p-4">
            <div className="flex justify-between items-center gap-4">
              <span 
                onClick={() => setErrorDetails(prev => prev ? {
                  ...prev,
                  showStack: !prev.showStack
                } : null)}
                className="cursor-pointer hover:underline"
              >
                {errorDetails.message}
              </span>
              <button 
                onClick={() => setErrorDetails(null)}
                className="text-white hover:text-gray-200"
              >
                ×
              </button>
            </div>
            
            {errorDetails.showStack && errorDetails.stack && (
              <div className="mt-4 p-2 bg-red-600 rounded text-sm font-mono">
                <div>Stack trace:</div>
                <pre className="overflow-auto max-h-48 whitespace-pre-wrap">
                  {errorDetails.stack}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

