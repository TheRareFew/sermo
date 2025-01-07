type ConnectionState = 'INITIAL' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'FAILED';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseDelay = 1000;
  private maxDelay = 30000;
  private url: string;
  private messageQueue: any[] = [];
  private connectionTimeout: number = 5000;
  private connectionTimer: NodeJS.Timeout | null = null;
  private eventHandlers: { [key: string]: (event: any) => void } = {};
  private connectionState: ConnectionState = 'INITIAL';

  constructor(
    url: string,
    private handlers: {
      onMessage: (event: MessageEvent) => void;
      onClose: () => void;
      onError: (error: Event) => void;
      onOpen: () => void;
      onConnectionError?: (error: Error) => void;
    }
  ) {
    this.url = url;
  }

  private getWebSocketState() {
    if (!this.ws) return 'null';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  private async waitForBackend(retries = 3, delay = 1000): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        // Try to connect to the backend health check endpoint
        const response = await fetch(this.url.replace('ws://', 'http://').replace('/ws/', '/health'));
        if (response.ok) {
          return true;
        }
      } catch (error) {
        console.log(`Backend check attempt ${i + 1} failed, retrying in ${delay}ms...`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return false;
  }

  private handleConnectionError(event: Event) {
    // Don't log the full event object as it may contain circular references
    const safeErrorInfo = {
      type: event.type,
      timestamp: new Date().toISOString(),
      connectionState: this.connectionState,
      wsState: this.getWebSocketState(),
      targetReadyState: (event.target as WebSocket)?.readyState,
      url: this.url,
      reconnectAttempts: this.reconnectAttempts,
    };

    console.log('WebSocket error occurred:', safeErrorInfo);

    // Handle the error based on connection state
    switch (this.connectionState) {
      case 'CONNECTING':
        this.connectionState = 'FAILED';
        this.cleanup(false);
        this.checkBackendAndReconnect();
        break;

      case 'CONNECTED':
        this.connectionState = 'RECONNECTING';
        this.cleanup(false);
        this.attemptReconnect();
        break;

      case 'RECONNECTING':
        // Already trying to reconnect, just log it
        console.log('Error during reconnection attempt');
        break;

      default:
        console.log(`Unexpected error in ${this.connectionState} state`);
        this.cleanup(true);
        break;
    }

    // Create a simple error object for the handler
    const error = new Error('WebSocket connection error');
    this.handlers.onError(error);
  }

  private async checkBackendAndReconnect() {
    try {
      const healthUrl = this.url.replace('ws://', 'http://').replace(/\/ws\/.+/, '/health');
      const response = await fetch(healthUrl);
      
      if (response.ok) {
        console.log('Backend is available, attempting reconnect');
        this.attemptReconnect();
      } else {
        console.log('Backend health check failed');
        this.handlers.onConnectionError?.(new Error('Backend server unavailable'));
      }
    } catch (error) {
      console.log('Backend appears to be down:', error);
      this.handlers.onConnectionError?.(new Error('Unable to reach backend server'));
    }
  }

  private setupEventListeners() {
    if (!this.ws) return;

    this.removeEventListeners();

    this.eventHandlers = {
      open: () => {
        this.connectionState = 'CONNECTED';
        if (this.connectionTimer) {
          clearTimeout(this.connectionTimer);
          this.connectionTimer = null;
        }
        this.reconnectAttempts = 0;
        this.handlers.onOpen();
        this.processMessageQueue();
      },
      message: this.handlers.onMessage,
      close: () => {
        this.connectionState = 'DISCONNECTED';
        this.cleanup(false);
        this.handlers.onClose();
        this.attemptReconnect();
      },
      error: (event: Event) => this.handleConnectionError(event)
    };

    Object.entries(this.eventHandlers).forEach(([event, handler]) => {
      this.ws?.addEventListener(event, handler);
    });
  }

  private removeEventListeners() {
    if (!this.ws) return;

    Object.entries(this.eventHandlers).forEach(([event, handler]) => {
      try {
        this.ws?.removeEventListener(event, handler);
      } catch (error) {
        console.error(`Error removing ${event} listener:`, error);
      }
    });

    this.eventHandlers = {};
  }

  private cleanup(closeConnection: boolean = true) {
    this.isConnecting = false;
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    if (closeConnection && this.ws) {
      this.removeEventListeners();
      try {
        this.ws.close(1000, 'Cleanup');
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      this.ws = null;
    }
  }

  connect() {
    if (this.connectionState === 'CONNECTING' || this.connectionState === 'RECONNECTING') {
      console.log(`Connection attempt already in progress (${this.connectionState})`);
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      this.processMessageQueue();
      return;
    }

    try {
      this.connectionState = 'CONNECTING';
      console.log(`Attempting to connect to: ${this.url}`);
      
      this.cleanup();
      this.ws = new WebSocket(this.url);
      this.setupEventListeners();
      
      // Set connection timeout
      this.connectionTimer = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          console.log('Connection timeout');
          this.connectionState = 'FAILED';
          this.cleanup();
          this.checkBackendAndReconnect();
        }
      }, this.connectionTimeout);

    } catch (error) {
      console.log('Error creating WebSocket:', error);
      this.connectionState = 'FAILED';
      this.cleanup();
      this.checkBackendAndReconnect();
    }
  }

  private processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  private attemptReconnect() {
    if (this.isConnecting) return;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      this.maxDelay
    );

    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch (error) {
        console.error('Error sending message:', error);
        this.messageQueue.push(data);  // Queue message if send fails
        this.handlers.onConnectionError?.(error instanceof Error ? error : new Error(String(error)));
      }
    } else {
      console.warn('WebSocket is not connected, queueing message');
      this.messageQueue.push(data);
      this.attemptReconnect();
    }
  }

  disconnect() {
    if (this.ws) {
      try {
        this.messageQueue = [];  // Clear message queue on disconnect
        this.ws.close(1000, 'Client disconnecting');
        this.ws = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
    }
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
} 