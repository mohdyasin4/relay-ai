import { useEffect, useState } from 'react';
import { DatabaseService } from '../services/databaseService';
import type { Contact, User } from '../types';

/**
 * Hook to merge selected contact with lastSeen from Users table
 */
export function useSelectedContactWithLastSeen(selectedContactId: string | null, contacts: Contact[]) {
  const [selectedContact, setSelectedContact] = useState<Contact & { lastSeen?: string } | null>(null);

  useEffect(() => {
    if (!selectedContactId) {
      setSelectedContact(null);
      return;
    }
    const contact = contacts.find(c => c.id === selectedContactId);
    if (!contact) {
      setSelectedContact(null);
      return;
    }
    // Only fetch lastSeen for non-AI contacts
    if (!contact.isAi) {
      DatabaseService.getUserById(selectedContactId).then((user: User | null) => {
        setSelectedContact({ ...contact, lastSeen: user?.lastSeen });
      });
    } else {
      setSelectedContact(contact);
    }
  }, [selectedContactId, contacts]);

  return selectedContact;
}
