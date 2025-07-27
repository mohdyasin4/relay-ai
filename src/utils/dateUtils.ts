import type { Contact } from '../types';

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function getTimelineDate(messageDate: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(messageDate, today)) {
    return 'Today';
  }
  if (isSameDay(messageDate, yesterday)) {
    return 'Yesterday';
  }
  return messageDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatPresence(contact: Contact): string {
    if (contact.status === 'online') {
        return 'Online';
    }
    if (contact.status === 'away') {
        return 'Away';
    }

    if (!contact.lastSeen) {
        return 'Offline';
    }
    
    const lastSeenDate = new Date(contact.lastSeen);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const timeFormat: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    };
    
    if (isSameDay(lastSeenDate, today)) {
        return `last seen today at ${lastSeenDate.toLocaleTimeString([], timeFormat)}`;
    }
    if (isSameDay(lastSeenDate, yesterday)) {
        return `last seen yesterday at ${lastSeenDate.toLocaleTimeString([], timeFormat)}`;
    }

    const dateFormat: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
    };
    return `last seen on ${lastSeenDate.toLocaleDateString([], dateFormat)} at ${lastSeenDate.toLocaleTimeString([], timeFormat)}`;
}