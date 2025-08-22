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
    model: 'gemini-2.5-pro',
    config: {
      systemInstruction: contact.systemInstruction,
    },
  });

  chats.set(contact.id, newChat);
  return newChat;
}

async function convertImageToBase64(url: string, file?: File): Promise<string> {
  // If it's already a base64 data URL, extract the base64 part
  if (url.startsWith('data:')) {
    return url.split(',')[1];
  }
  
  // If we have the original file, convert it to base64
  if (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:image/...;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  // If it's a blob URL, fetch and convert
  if (url.startsWith('blob:')) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:image/...;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('Cannot convert blob URL to base64:', error);
      return '';
    }
  }
  
  console.warn('Unsupported URL format for base64 conversion:', url);
  return '';
}

function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export async function sendMessageToBot(contact: Contact, message: Message) {
  const chat = getOrCreateChat(contact);

  const messageParts: any[] = [];
  
  // Add text if present
  if (message.text && message.text.trim()) {
    messageParts.push({ text: message.text });
  }
  
  // Handle single attachment (backward compatibility)
  if (message.attachment && isImageFile(message.attachment.mimeType || '')) {
    const base64Data = await convertImageToBase64(message.attachment.url, (message.attachment as any).file);
    if (base64Data) {
      messageParts.unshift({
        inlineData: {
          mimeType: message.attachment.mimeType || 'image/png',
          data: base64Data
        }
      });
    }
  }
  
  // Handle multiple attachments
  if (message.attachments) {
    for (const attachment of message.attachments) {
      if (isImageFile(attachment.mimeType || '')) {
        const base64Data = await convertImageToBase64(attachment.url, attachment.file);
        if (base64Data) {
          messageParts.unshift({
            inlineData: {
              mimeType: attachment.mimeType || 'image/png',
              data: base64Data
            }
          });
        }
      }
    }
  }
  
  // If no text and no valid images, add a default prompt
  if (messageParts.length === 0) {
    messageParts.push({ text: "Please analyze this image." });
  }

  console.log('Sending message to Gemini with parts:', messageParts.length, 'parts');
  console.log('Message parts preview:', messageParts.map(part => ({ 
    type: part.text ? 'text' : 'image', 
    textLength: part.text?.length, 
    imageMimeType: part.inlineData?.mimeType 
  })));

  const result = await chat.sendMessageStream({ message: messageParts });
  return result;
}