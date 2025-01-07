export interface UserSettings {
  showSystemMessages: boolean;
  displayName: string;
  userStatus: 'online' | 'away' | 'busy' | 'offline';
  developerMode: boolean;
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  accountName: string;
  timestamp: string;
  type: string;
  channelId: string;
} 