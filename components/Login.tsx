'use client'

import { useState } from 'react'

interface LoginProps {
  onLogin: (username: string) => void
  onSwitchToRegister: () => void
}

export default function Login({ onLogin, onSwitchToRegister }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Login failed')
      }

      const data = await response.json()
      onLogin(username)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg border-2 border-green-400 w-96">
        <h1 className="text-green-400 text-2xl mb-6 text-center">Sermo Login</h1>
        
        {error && (
          <div className="bg-red-900 text-red-300 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-green-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black text-green-400 p-2 rounded border border-green-400 focus:outline-none focus:border-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-green-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black text-green-400 p-2 rounded border border-green-400 focus:outline-none focus:border-green-500"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-green-400 text-black py-2 rounded hover:bg-green-500 transition-colors"
          >
            Login
          </button>
        </form>

        <div className="text-center text-green-400 mt-4">
          Need an account?{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-green-300 hover:text-green-200 underline focus:outline-none"
            type="button"
          >
            Register here
          </button>
        </div>
      </div>
    </div>
  )
} 