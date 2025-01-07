'use client'

import { useEffect } from 'react'
import { UserSettings } from '@/types'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
  settings?: UserSettings
}

export default function ErrorBoundary({ 
  error,
  reset,
  settings = { developerMode: false }
}: ErrorBoundaryProps) {
  useEffect(() => {
    // Always log to console regardless of developer mode
    console.error('Error:', error)
  }, [error])

  // Don't render anything if developer mode is off
  if (!settings.developerMode) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg">
      <div className="flex justify-between items-center gap-4">
        <span>{error.message}</span>
        <button 
          onClick={reset}
          className="text-white hover:text-gray-200"
        >
          ×
        </button>
      </div>
    </div>
  )
} 