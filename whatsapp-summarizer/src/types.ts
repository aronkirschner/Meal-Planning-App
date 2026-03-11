export interface WhatsAppConfig {
  instanceId: string;
  apiToken: string;
  chatId: string;
  chatName: string;
  messageCount: number;
}

export interface WhatsAppSummary {
  id: string;
  createdAt: string;
  messageCount: number;
  content: string;
  generatedBy: string;
  chatName: string;
}

export interface GreenApiMessage {
  type: string;
  idMessage: string;
  timestamp: number;
  typeMessage: string;
  chatId: string;
  senderId: string;
  senderName: string;
  textMessage?: string;
  caption?: string;
}

export interface GreenApiChat {
  id: string;
  name: string;
  isGroup: boolean;
}
