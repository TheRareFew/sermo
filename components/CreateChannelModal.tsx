import { useState } from 'react';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChannel: (channelName: string) => void;
}

export default function CreateChannelModal({ isOpen, onClose, onCreateChannel }: CreateChannelModalProps) {
  const [activeTab, setActiveTab] = useState<'standard' | 'special'>('standard');
  const [channelName, setChannelName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelName.trim()) {
      onCreateChannel(channelName.trim());
      setChannelName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 w-96 rounded-lg border-2 border-green-400 shadow-lg">
        {/* Header */}
        <div className="border-b-2 border-green-400 p-4">
          <h2 className="text-green-400 text-xl font-bold font-['Courier_New']">Create Channel</h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b-2 border-green-400">
          <button
            className={`flex-1 p-2 font-['Courier_New'] ${
              activeTab === 'standard'
                ? 'bg-green-400 text-black'
                : 'text-green-400 hover:bg-gray-700'
            }`}
            onClick={() => setActiveTab('standard')}
          >
            Standard
          </button>
          <button
            className={`flex-1 p-2 font-['Courier_New'] ${
              activeTab === 'special'
                ? 'bg-green-400 text-black'
                : 'text-green-400 hover:bg-gray-700'
            }`}
            onClick={() => setActiveTab('special')}
          >
            Special
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === 'standard' ? (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-green-400 mb-2 font-['Courier_New']">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full bg-black text-green-400 p-2 border-2 border-green-400 
                    focus:outline-none font-['Courier_New']"
                  placeholder="Enter channel name"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-green-400 border-2 border-green-400 
                    hover:bg-gray-700 font-['Courier_New']"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-400 text-black 
                    hover:bg-green-500 font-['Courier_New']"
                >
                  Create
                </button>
              </div>
            </form>
          ) : (
            <div className="text-green-400 font-['Courier_New']">
              Special channel options coming soon...
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 