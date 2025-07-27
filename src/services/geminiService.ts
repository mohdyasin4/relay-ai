import { GoogleGenAI, Chat } from "@google/genai";
import type { Contact, Message } from '../types';

if (!process.env.API_KEY) {
  alert("API_KEY environment variable is not set. Please configure it to use the application.");
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const chats = new Map<string, Chat>();

function getOrCreateChat(contact: Contact): Chat {
  if (chats.has(contact.id)) {
    return chats.get(contact.id)!;
  }

  const newChat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: contact.systemInstruction,
    },
  });

  chats.set(contact.id, newChat);
  return newChat;
}

export async function sendMessageToBot(contact: Contact, message: Message) {
  const chat = getOrCreateChat(contact);

  const textPart = { text: message.text };
  
  const messageParts = message.attachment
    ? [{ inlineData: { mimeType: 'image/png', data: message.attachment.url.split(',')[1] } }, textPart]
    : [textPart];

  const result = await chat.sendMessageStream({ message: messageParts });
  return result;
}