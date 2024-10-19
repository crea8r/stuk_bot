export interface MessageObject {
  from: string;
  text: string;
  date: Date;
  reply_to_message: number | null;
}

export interface Conversation {
  messages: MessageObject[];
}

export interface ChatStore {
  [chatId: string]: Conversation[];
}
