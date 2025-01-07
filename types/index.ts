export interface Message {
    id: string
    content: string
    sender: string
    accountName: string
    timestamp: string
    type?: 'system' | 'message'
    userStatus?: string
  }
  
  export interface Channel {
    id: string
    name: string
    messages: Message[]
  }
  
  export interface UserSettings {
    showSystemMessages: boolean
    displayName: string
    userStatus: string
  }
  
  