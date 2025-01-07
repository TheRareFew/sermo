'use client'

import { useState, useEffect } from 'react'
import ChatWindow from '@/components/ChatWindow'
import Login from '@/components/Login'
import Register from '@/components/Register'

type AuthView = 'login' | 'register'

function useChannels() {
  const [channels, setChannels] = useState([]);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/channels');
        if (!response.ok) {
          throw new Error('Failed to fetch channels');
        }
        const data = await response.json();
        setChannels(data);
      } catch (error) {
        console.error('Error fetching initial channels:', error);
      }
    };

    fetchChannels();
  }, []);

  return channels;
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [authView, setAuthView] = useState<AuthView>('login');
  const channels = useChannels();

  if (!currentUser) {
    if (authView === 'login') {
      return (
        <Login 
          onLogin={setCurrentUser} 
          onSwitchToRegister={() => setAuthView('register')} 
        />
      );
    }
    
    return (
      <Register 
        onRegister={setCurrentUser}
        onSwitchToLogin={() => setAuthView('login')}
      />
    );
  }

  return (
    <main className="min-h-screen">
      <ChatWindow 
        currentUser={currentUser}
        initialChannels={channels}
        directMessages={{}}
      />
    </main>
  );
}

