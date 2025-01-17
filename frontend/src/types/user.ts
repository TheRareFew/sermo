export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  profile_picture_url?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  last_seen?: string;
  is_bot: boolean;
} 