
import { getTimelineDate, formatPresence } from '../dateUtils';
import type { Contact } from '../../types';

describe('dateUtils', () => {
  describe('getTimelineDate', () => {
    const realDateNow = Date.now.bind(global.Date);

    beforeAll(() => {
      // Mock Date.now to a fixed timestamp for predictable results
      const fixedDate = new Date('2024-05-21T10:00:00.000Z');
      global.Date.now = jest.fn(() => fixedDate.getTime());
    });

    afterAll(() => {
      global.Date.now = realDateNow;
    });

    it('returns "Today" for the current date', () => {
      const today = new Date();
      expect(getTimelineDate(today)).toBe('Today');
    });

    it('returns "Yesterday" for the previous date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(getTimelineDate(yesterday)).toBe('Yesterday');
    });

    it('returns a formatted date for older dates', () => {
      const olderDate = new Date('2024-03-15T12:00:00.000Z');
      // The exact format depends on the locale of the test runner,
      // but it should contain the month, day, and year.
      const result = getTimelineDate(olderDate);
      expect(result).toContain('March');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });
  });

  describe('formatPresence', () => {
    it('returns "Online" for online status', () => {
      const contact: Contact = { id: '1', name: 'Test', status: 'online' };
      expect(formatPresence(contact)).toBe('Online');
    });
    
    it('returns "Away" for away status', () => {
      const contact: Contact = { id: '1', name: 'Test', status: 'away' };
      expect(formatPresence(contact)).toBe('Away');
    });
    
    it('returns "Offline" for offline status with no lastSeen', () => {
      const contact: Contact = { id: '1', name: 'Test', status: 'offline' };
      expect(formatPresence(contact)).toBe('Offline');
    });

    it('returns formatted last seen time for today', () => {
        const lastSeen = new Date();
        lastSeen.setHours(lastSeen.getHours() - 2); // 2 hours ago
        const contact: Contact = { id: '1', name: 'Test', status: 'offline', lastSeen: lastSeen.toISOString() };
        expect(formatPresence(contact)).toMatch(/last seen today at/);
    });

    it('returns formatted last seen time for yesterday', () => {
        const lastSeen = new Date();
        lastSeen.setDate(lastSeen.getDate() - 1);
        const contact: Contact = { id: '1', name: 'Test', status: 'offline', lastSeen: lastSeen.toISOString() };
        expect(formatPresence(contact)).toMatch(/last seen yesterday at/);
    });

    it('returns formatted date for older last seen', () => {
        const lastSeen = new Date('2024-01-01T12:00:00Z');
        const contact: Contact = { id: '1', name: 'Test', status: 'offline', lastSeen: lastSeen.toISOString() };
        expect(formatPresence(contact)).toMatch(/last seen on Jan 1 at/);
    });
  });
});
