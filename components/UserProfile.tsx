'use client'

import { useState, useEffect } from 'react'

interface UserProfileProps {
  isOpen: boolean
  onClose: () => void
  currentUser: string
  status: string
  onStatusChange: (status: string) => void
  onDisplayNameChange: (name: string) => void
}

const STATUSES = {
  online: { label: 'Online', color: 'bg-green-400' },
  away: { label: 'Away', color: 'bg-yellow-400' },
  busy: { label: 'Busy', color: 'bg-red-400' },
  offline: { label: 'Offline', color: 'bg-gray-400' }
}

export default function UserProfile({ 
  isOpen, 
  onClose, 
  currentUser, 
  status, 
  onStatusChange,
  onDisplayNameChange 
}: UserProfileProps) {
  const [editName, setEditName] = useState(currentUser)
  
  useEffect(() => {
    setEditName(currentUser)
  }, [currentUser])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-gray-800 border-2 border-green-400 p-6 rounded-lg w-96">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-green-400 text-xl">Profile Settings</h2>
          <button 
            onClick={onClose}
            className="text-green-400 hover:text-green-300 focus:outline-none"
          >
            [X]
          </button>
        </div>

        <div className="space-y-6">
          {/* Display Name */}
          <div className="space-y-2">
            <label className="text-green-400 block">Display Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-gray-900 text-green-400 p-2 rounded flex-1 border border-green-400 focus:outline-none"
              />
              <button
                onClick={() => {
                  onDisplayNameChange(editName)
                  onClose()
                }}
                className="bg-green-400 text-black px-4 py-2 rounded hover:bg-green-500"
              >
                Save
              </button>
            </div>
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <label className="text-green-400 block">Status</label>
            <div className="space-y-2">
              {Object.entries(STATUSES).map(([key, { label, color }]) => (
                <button
                  key={key}
                  onClick={() => onStatusChange(key)}
                  className={`w-full p-2 text-left rounded flex items-center gap-2 hover:bg-gray-700 ${
                    status === key ? 'bg-gray-700' : ''
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  <span className="text-green-400">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 