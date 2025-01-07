'use client'

import { useEffect, useState } from 'react'
import { updateErrorHandlerSettings, getCurrentSettings } from '@/utils/errorHandler'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  const settings = getCurrentSettings()
  const isDevelopment = process.env.NODE_ENV === 'development' && settings.developerMode

  if (!isDevelopment) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 bg-red-500 text-white rounded shadow-lg max-w-xl">
      <div className="p-4">
        <div className="flex justify-between items-center gap-4">
          <span 
            onClick={() => setShowDetails(!showDetails)}
            className="cursor-pointer hover:underline"
          >
            {error.message}
          </span>
          <button 
            onClick={reset}
            className="text-white hover:text-gray-200"
          >
            ×
          </button>
        </div>
        
        {showDetails && (
          <div className="mt-4 p-2 bg-red-600 rounded text-sm font-mono">
            <div>Stack trace:</div>
            <pre className="overflow-auto max-h-48 whitespace-pre-wrap">
              {error.stack}
            </pre>
            {error.digest && (
              <div className="mt-2">
                <div>Error Digest:</div>
                <code>{error.digest}</code>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 