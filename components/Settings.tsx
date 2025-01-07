'use client'

import { useState } from 'react'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  settings: UserSettings
  onSettingChange: (setting: keyof UserSettings, value: any) => void
}

export default function Settings({ isOpen, onClose, settings, onSettingChange }: SettingsProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-gray-800 p-6 rounded-lg w-96">
        <h2 className="text-xl text-green-400 mb-4">Settings</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-green-400">Show System Messages</label>
            <input
              type="checkbox"
              checked={settings.showSystemMessages}
              onChange={(e) => onSettingChange('showSystemMessages', e.target.checked)}
              className="form-checkbox text-green-400 bg-gray-700 border-green-400"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-green-400">Developer Mode</label>
            <input
              type="checkbox"
              checked={settings.developerMode}
              onChange={(e) => onSettingChange('developerMode', e.target.checked)}
              className="form-checkbox text-green-400 bg-gray-700 border-green-400"
            />
          </div>

          {/* ... other settings ... */}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-green-400 text-black py-2 rounded hover:bg-green-500"
        >
          Close
        </button>
      </div>
    </div>
  )
} 