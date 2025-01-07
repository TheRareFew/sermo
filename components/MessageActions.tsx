'use client'

interface MessageActionsProps {
  isOpen: boolean
  onClose: () => void
  onDelete: (messageId: string, accountName: string) => void
  messageId?: string
  accountName?: string
  position: { x: number, y: number }
}

export default function MessageActions({ 
  isOpen, 
  onClose, 
  onDelete,
  messageId,
  accountName,
  position 
}: MessageActionsProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed z-50"
      style={{ top: position.y, left: position.x }}
    >
      <div className="bg-gray-800 border border-green-400 rounded shadow-lg py-1 min-w-[160px]">
        <button
          onClick={() => {
            if (messageId && accountName) {
              onDelete(messageId, accountName)
            }
            onClose()
          }}
          className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 flex items-center gap-2"
        >
          [X] Delete Message
        </button>
      </div>
      <div 
        className="fixed inset-0 z-[-1]" 
        onClick={onClose}
      />
    </div>
  )
} 