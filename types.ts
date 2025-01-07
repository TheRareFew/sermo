export interface UserSettings {
  showSystemMessages: boolean;
  displayName: string;
  userStatus: 'online' | 'away' | 'busy' | 'offline';
  developerMode: boolean;
} 