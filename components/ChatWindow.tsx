'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Message, Channel, UserSettings } from '../types'
import Settings from './Settings'
import MessageActions from './MessageActions'
import UserProfile from './UserProfile'
import { WebSocketManager } from '@/utils/WebSocketManager'
import { updateErrorHandlerSettings } from '@/utils/errorHandler'
import CreateChannelModal from './CreateChannelModal'

interface ChatWindowProps {
  currentUser: string
  initialChannels: Channel[]
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

export default function ChatWindow({ currentUser, initialChannels, directMessages }: ChatWindowProps) {
  const [activeChannel, setActiveChannel] = useState<string | null>(() => 
    initialChannels[0]?.id ? String(initialChannels[0].id) : null
  );
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
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [availableChannels, setAvailableChannels] = useState<Channel[]>([]);
  const shouldScrollToBottomRef = useRef(true);
  const lastChannelRef = useRef<string | null>(null);

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

  // Add a dedicated effect for channel switching and scrolling
  useEffect(() => {
    if (!activeChannel) return;
    
    // Only scroll if channel has changed
    if (lastChannelRef.current !== activeChannel) {
      lastChannelRef.current = activeChannel;
      
      // Try multiple times to ensure messages are loaded
      const scrollAttempts = [0, 100, 300, 500].map(delay => {
        return new Promise<void>(resolve => {
          setTimeout(() => {
            if (messageContainerRef.current) {
              messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
              setIsNearBottom(true);
            }
            resolve();
          }, delay);
        });
      });
      
      // Execute all scroll attempts
      Promise.all(scrollAttempts);
      
      return () => {
        // No cleanup needed for completed timeouts
      };
    }
  }, [activeChannel, allMessages]); // Include allMessages to catch when messages load

  // Add an additional effect specifically for initial load
  useEffect(() => {
    if (allMessages.length > 0 && messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
      setIsNearBottom(true);
    }
  }, [allMessages.length]); // Only depend on message count

  // Update the message loading effect to remove scroll logic
  useEffect(() => {
    if (!activeChannel) return;
    
    const loadMessages = async () => {
      try {
        const url = new URL(`http://localhost:8000/api/messages/channel/${activeChannel}`);
        const response = await fetch(url.toString());
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `Failed to fetch messages: ${response.status}`);
        }

        // Process messages once
        const processedMessages = data.messages.map(msg => ({
          ...msg,
          channelId: String(msg.channelId)
        }));
        
        setAllMessages(processedMessages);
        setVisibleMessages(processedMessages);
        setCurrentPage(Math.floor(data.totalMessages / 25) - 1);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();
  }, [activeChannel]);

  // Update scroll handler to track when user manually scrolls
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isNearTop = container.scrollTop < 100;
    
    const scrollPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
    const newIsNearBottom = scrollPosition < 100;
    setIsNearBottom(newIsNearBottom);
    
    // Update scroll flag based on user scroll
    shouldScrollToBottomRef.current = newIsNearBottom;
    
    if (isNearTop && currentPage > 0) {
      const prevPage = currentPage - 1;
      
      // Store current scroll position
      const currentScrollHeight = container.scrollHeight;
      
      // Load previous page
      const loadPreviousPage = async () => {
        try {
          const url = new URL(`http://localhost:8000/api/messages/channel/${activeChannel}`);
          url.searchParams.append('page', prevPage.toString());
          const response = await fetch(url.toString());
          
          if (!response.ok) {
            throw new Error(`Failed to fetch messages: ${response.status}`);
          }
          
          const data = await response.json();
          const olderMessages = data.messages;
          
          // Prepend older messages to both arrays
          setAllMessages(prev => [...olderMessages, ...prev]);
          setVisibleMessages(prev => [...olderMessages, ...prev]);
          setCurrentPage(prevPage);
          
          // Maintain scroll position
          requestAnimationFrame(() => {
            if (messageContainerRef.current) {
              const newScrollHeight = messageContainerRef.current.scrollHeight;
              const scrollDiff = newScrollHeight - currentScrollHeight;
              messageContainerRef.current.scrollTop = scrollDiff + 100;
            }
          });
        } catch (error) {
          console.error('Error loading previous page:', error);
        }
      };
      
      loadPreviousPage();
    }
  }, [currentPage, activeChannel]);

  // Add a scroll handler for new messages
  const scrollToBottom = useCallback(() => {
    if (messageContainerRef.current && isNearBottom) {
      const container = messageContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [isNearBottom]);

  // Add status update function
  const updateUserStatus = useCallback((status: string) => {
    if (wsManager?.isConnected() && activeChannel) {
      wsManager.send({
        type: 'status_update',
        status: status
      });
    }
  }, [wsManager, activeChannel]);

  // Update the message handler to be simpler
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      // Only process messages for the current channel
      if (data.channelId && String(data.channelId) !== String(activeChannel)) {
        return;
      }
      
      if (data.action === 'delete') {
        const messageId = data.messageId;
        const filterMessage = (prev: Message[]) => prev.filter(msg => msg.id !== messageId);
        setAllMessages(filterMessage);
        setVisibleMessages(filterMessage);
      } else if (data.content && data.sender) {
        const newMessage: Message = {
          id: data.id || `new-${generateUniqueId()}-${new Date().toISOString()}`,
          content: data.content,
          sender: data.sender,
          accountName: data.accountName || data.sender,
          timestamp: data.timestamp || new Date().toISOString(),
          type: data.type || 'message',
          channelId: String(activeChannel)
        };

        const addMessage = (prev: Message[]) => {
          if (prev.some(msg => msg.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        };

        setAllMessages(addMessage);
        setVisibleMessages(addMessage);

        if (isNearBottom) {
          requestAnimationFrame(scrollToBottom);
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }, [activeChannel, isNearBottom, scrollToBottom]);

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

  // Update the send message handler to be more robust
  const handleSendMessage = useCallback(() => {
    if (inputMessage.trim() === '' || !wsManager?.isConnected() || !activeChannel) return;
    
    const timestamp = new Date().toISOString();
    const messageId = `new-${generateUniqueId()}-${timestamp}`;
    
    const newMessage = {
      id: messageId,
      content: inputMessage.trim(),
      sender: settings.displayName,
      accountName: currentUser,
      timestamp: timestamp,
      type: 'message',
      channelId: String(activeChannel)
    };
    
    // Clear input immediately to prevent double-sends
    setInputMessage('');
    
    try {
      wsManager.send(newMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      // Optionally show an error to the user
    }
  }, [inputMessage, wsManager, settings.displayName, currentUser, activeChannel]);

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
      // Send delete request to server
      const response = await fetch(`http://localhost:8000/api/messages/${messageId}?account_name=${encodeURIComponent(currentUser)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      // Send WebSocket delete message
      if (wsManager?.isConnected()) {
        wsManager.send({
          action: 'delete',
          messageId: messageId
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
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

  // Call updateUserStatus when user status changes
  useEffect(() => {
    if (settings.userStatus) {
      updateUserStatus(settings.userStatus);
    }
  }, [settings.userStatus, updateUserStatus]);

  // Add handleStatusChange function
  const handleStatusChange = useCallback((status: string) => {
    // Update local settings
    handleSettingChange('userStatus', status);
    
    // Send status update to server
    if (wsManager?.isConnected() && activeChannel) {
      wsManager.send({
        type: 'status_update',
        status: status
      });
    }
  }, [wsManager, activeChannel, handleSettingChange]);

  // Update handleDisplayNameChange to also update local settings
  const handleDisplayNameChange = useCallback((newName: string) => {
    // Update local settings
    handleSettingChange('displayName', newName);
    
    // Send name update to server
    if (wsManager?.isConnected() && activeChannel) {
      wsManager.send({
        type: 'display_name_update',
        newName: newName
      });
    }
  }, [wsManager, activeChannel, handleSettingChange]);

  // Add effect to fetch channels
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/channels');
        if (!response.ok) {
          throw new Error('Failed to fetch channels');
        }
        const data = await response.json();
        setAvailableChannels(data);
      } catch (error) {
        console.error('Error fetching channels:', error);
      }
    };

    fetchChannels();
  }, []);

  // Update handleCreateChannel to update channels list
  const handleCreateChannel = async (channelName: string) => {
    try {
      const response = await fetch('http://localhost:8000/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: channelName }),
      });

      if (!response.ok) {
        throw new Error('Failed to create channel');
      }

      const newChannel = await response.json();
      setAvailableChannels(prev => [...prev, newChannel]);
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 font-['MS_Sans_Serif']">
      <div className="w-64 bg-gray-800 text-green-400 flex flex-col border-r-2 border-green-400 
        shadow-[2px_2px_0px_0px_rgba(34,197,94,0.3)]">
        <div className="flex-1 p-4 pt-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold border-b-2 border-green-400 pb-2">Channels</h2>
            <button
              onClick={() => setIsCreateChannelOpen(true)}
              className="text-green-400 hover:text-green-300 focus:outline-none
                border border-green-400 px-2 py-1 text-sm
                shadow-[2px_2px_0px_0px_rgba(34,197,94,0.3)]
                active:shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.3)]"
            >
              + New
            </button>
          </div>
          {availableChannels.map(channel => (
            <div
              key={channel.id}
              className={`cursor-pointer p-2 mb-1 border border-green-400 font-['Courier_New'] 
                ${String(activeChannel) === String(channel.id)
                  ? 'bg-green-400 text-black shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.3)]' 
                  : 'hover:bg-gray-700'}`}
              onClick={() => { 
                const channelId = String(channel.id);
                setActiveChannel(channelId);
                setActiveDM(null);
              }}
            >
              # {channel.name}
            </div>
          ))}

          <h2 className="text-xl mt-6 mb-4 font-bold border-b-2 border-green-400 pb-2">Direct Messages</h2>
          {Object.keys(directMessages).map(user => (
            <div
              key={user}
              className={`cursor-pointer p-2 mb-1 border border-green-400 font-['Courier_New']
                ${activeDM === user 
                  ? 'bg-green-400 text-black shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.3)]' 
                  : 'hover:bg-gray-700'}`}
              onClick={() => { setActiveDM(user); setActiveChannel(null); }}
            >
              @ {user}
            </div>
          ))}
        </div>

        <div className="p-3 border-t-2 border-green-400 flex justify-between items-center 
          shadow-[0px_-2px_0px_0px_rgba(34,197,94,0.3)]">
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 text-green-400 hover:text-green-300 focus:outline-none
              border border-green-400 px-2 py-1 shadow-[2px_2px_0px_0px_rgba(34,197,94,0.3)]
              active:shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.3)]"
          >
            <span className="font-['Courier_New']">👤</span>
            <div className={`w-2 h-2 rounded-full ${
              settings.userStatus === 'online' ? 'bg-green-400' :
              settings.userStatus === 'away' ? 'bg-yellow-400' :
              settings.userStatus === 'busy' ? 'bg-red-400' :
              'bg-gray-400'
            }`} />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="text-green-400 hover:text-green-300 focus:outline-none
              border border-green-400 px-2 py-1 shadow-[2px_2px_0px_0px_rgba(34,197,94,0.3)]
              active:shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.3)]"
          >
            <span className="font-['Courier_New']">⚙</span>
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="p-4 pt-4 border-b-2 border-green-400 flex items-center justify-between 
          bg-gray-800 shadow-[inset_0px_2px_0px_0px_rgba(34,197,94,0.3)]">
          <h2 className="text-xl text-green-400 font-bold">
            {activeChannel ? `#${activeChannel}` : `@${activeDM}`}
          </h2>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400' :
              connectionStatus === 'connecting' ? 'bg-yellow-400' :
              'bg-red-400'
            }`} />
            <span className="text-sm text-gray-400 font-['Courier_New']">
              {connectionStatus === 'connected' ? '[CONNECTED]' :
               connectionStatus === 'connecting' ? '[CONNECTING...]' :
               '[DISCONNECTED]'}
            </span>
          </div>
        </div>

        <div 
          ref={messageContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2 bg-black font-['Courier_New']
            shadow-[inset_2px_2px_0px_0px_rgba(34,197,94,0.3)]"
          onScroll={handleScroll}
        >
          {visibleMessages.length === 0 ? (
            <div className="text-gray-500 text-center">No messages yet</div>
          ) : (
            visibleMessages.map((message, index) => {
              console.log('Rendering message:', message); // Debug log
              return (
                <div 
                  key={`${message.id}-${index}`}
                  className={`p-2 rounded relative group border border-green-400
                    ${message.type === 'system' 
                      ? 'bg-gray-700 text-gray-400 italic text-sm' 
                      : 'bg-gray-800'}`}
                >
                  <span className="font-bold text-green-400">{`[${message.sender}]`}: </span>
                  <span className="text-gray-300">{message.content}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="flex border-t-2 border-green-400 
          shadow-[0px_-2px_0px_0px_rgba(34,197,94,0.3)]">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            className="flex-grow bg-black text-green-400 py-[14px] px-4 focus:outline-none font-['Courier_New']
              shadow-[inset_2px_2px_0px_0px_rgba(34,197,94,0.3)]"
          />
          <button
            onClick={handleSendMessage}
            className="bg-green-400 text-black px-4 hover:bg-green-500 font-bold
              border-l-2 border-green-400 shadow-[2px_0px_0px_0px_rgba(34,197,94,0.3)]
              active:shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.3)]"
          >
            SEND
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
        onStatusChange={handleStatusChange}
        onDisplayNameChange={handleDisplayNameChange}
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
      <CreateChannelModal
        isOpen={isCreateChannelOpen}
        onClose={() => setIsCreateChannelOpen(false)}
        onCreateChannel={handleCreateChannel}
      />
    </div>
  )
}

