'use client'

import { useState } from 'react'
import ChatWindow from '@/components/ChatWindow'
import Login from '@/components/Login'
import Register from '@/components/Register'

type AuthView = 'login' | 'register'

export default function Home() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [authView, setAuthView] = useState<AuthView>('login')

  if (!currentUser) {
    if (authView === 'login') {
      return (
        <Login 
          onLogin={setCurrentUser} 
          onSwitchToRegister={() => setAuthView('register')} 
        />
      )
    }
    
    return (
      <Register 
        onRegister={setCurrentUser}
        onSwitchToLogin={() => setAuthView('login')}
      />
    )
  }

  const mockChannels = [
    { id: 'general', name: 'General' },
    { id: 'random', name: 'Random' }
  ]

  const mockDirectMessages = {
    'user1': [],
    'user2': []
  }

  return (
    <main className="min-h-screen">
      <ChatWindow 
        currentUser={currentUser}
        channels={mockChannels}
        directMessages={mockDirectMessages}
      />
    </main>
  )
}

