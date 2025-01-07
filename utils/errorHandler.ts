import { UserSettings } from '@/types'

let currentSettings: UserSettings = {
  showSystemMessages: true,
  displayName: '',
  userStatus: 'online',
  developerMode: false
}

export function updateErrorHandlerSettings(settings: UserSettings) {
  currentSettings = settings
}

export function getCurrentSettings(): UserSettings {
  return currentSettings
}

export function handleError(error: Error) {
  console.error('Error:', error)
  return currentSettings.developerMode ? error : null
} 