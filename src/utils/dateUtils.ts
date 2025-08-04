  import moment from 'moment';
  import type { Contact } from '../types';

  /**
   * Date utilities using moment.js for consistent timestamp formatting
   */
  export class DateUtils {
    /**
     * Format a timestamp for display in chat messages
     * Shows time for today, "Yesterday" + time for yesterday, or full date for older
     */
    static formatMessageTime(timestamp: string | Date): string {
      const messageMoment = DateUtils.getMoment(timestamp);
      const now = moment();
      
      if (messageMoment.isSame(now, 'day')) {
        // Today - show just time (e.g., "2:30 PM")
        return messageMoment.format('h:mm A');
      } else if (messageMoment.isSame(now.clone().subtract(1, 'day'), 'day')) {
        // Yesterday - show "Yesterday" + time
        return `Yesterday ${messageMoment.format('h:mm A')}`;
      } else if (messageMoment.isSame(now, 'year')) {
        // This year - show month/day + time (e.g., "Jan 15, 2:30 PM")
        return messageMoment.format('MMM D, h:mm A');
      } else {
        // Different year - show full date + time (e.g., "Jan 15, 2023, 2:30 PM")
        return messageMoment.format('MMM D, YYYY, h:mm A');
      }
    }

    /**
     * Format a timestamp for display in sidebar (last message preview)
     * More compact format suitable for limited space
     */
    static formatSidebarTime(timestamp: string | Date): string {
      const messageMoment = DateUtils.getMoment(timestamp);
      const now = moment();
      
      if (messageMoment.isSame(now, 'day')) {
        // Today - show just time (e.g., "2:30 PM")
        return messageMoment.format('h:mm A');
      } else if (messageMoment.isSame(now.clone().subtract(1, 'day'), 'day')) {
        // Yesterday - show "Yesterday"
        return 'Yesterday';
      } else if (messageMoment.isSame(now, 'week')) {
        // This week - show day name (e.g., "Monday")
        return messageMoment.format('dddd');
      } else if (messageMoment.isSame(now, 'year')) {
        // This year - show month/day (e.g., "Jan 15")
        return messageMoment.format('MMM D');
      } else {
        // Different year - show year (e.g., "2023")
        return messageMoment.format('MMM D, YYYY');
      }
    }

    /**
     * Format a timestamp for date separators in chat
     * Shows full date in a readable format
     */
    static formatDateSeparator(timestamp: string | Date): string {
      const messageMoment = DateUtils.getMoment(timestamp);
      const now = moment();
      
      if (messageMoment.isSame(now, 'day')) {
        return 'Today';
      } else if (messageMoment.isSame(now.clone().subtract(1, 'day'), 'day')) {
        return 'Yesterday';
      } else if (messageMoment.isSame(now, 'year')) {
        // This year - show day, month date (e.g., "Monday, January 15")
        return messageMoment.format('dddd, MMMM D');
      } else {
        // Different year - show day, month date, year (e.g., "Monday, January 15, 2023")
        return messageMoment.format('dddd, MMMM D, YYYY');
      }
    }

    /**
     * Format a timestamp for tooltips (more detailed)
     * Shows full date and time information
     */
    static formatTooltip(timestamp: string | Date): string {
      const messageMoment = DateUtils.getMoment(timestamp);
      
      return messageMoment.format('dddd, MMMM D, YYYY [at] h:mm:ss A');
    }

    /**
     * Format relative time (e.g., "2 hours ago", "3 days ago")
     * Useful for "last seen" or activity indicators
     */
    static formatRelativeTime(timestamp: string | Date): string {
      const messageMoment = DateUtils.getMoment(timestamp);
      return messageMoment.fromNow();
    }

    /**
     * Format timestamp for friend request notifications
     * Shows when the request was sent
     */
    static formatNotificationTime(timestamp: string | Date): string {
      const messageMoment = DateUtils.getMoment(timestamp);
      const now = moment();
      
      const diffMinutes = now.diff(messageMoment, 'minutes');
      const diffHours = now.diff(messageMoment, 'hours');
      const diffDays = now.diff(messageMoment, 'days');
      
      if (diffMinutes < 1) {
        return 'Just now';
      } else if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return messageMoment.format('MMM D');
      }
    }

    /**
     * Check if a timestamp is from today
     */
    static isToday(timestamp: string | Date): boolean {
      const timestampMoment = DateUtils.getMoment(timestamp);
      return timestampMoment.isSame(moment(), 'day');
    }

    /**
     * Check if a timestamp is from yesterday
     */
    static isYesterday(timestamp: string | Date): boolean {
      const timestampMoment = DateUtils.getMoment(timestamp);
      return timestampMoment.isSame(moment().subtract(1, 'day'), 'day');
    }

    /**
     * Get a moment instance for advanced operations
     */
    static getMoment(timestamp: string | Date): moment.Moment {
      // If timestamp is a Date object, convert it directly
      if (timestamp instanceof Date) {
        return moment(timestamp);
      }
      
      // If timestamp is a string
      if (typeof timestamp === 'string') {
        // If it has a Z suffix, it's explicitly UTC
        if (timestamp.endsWith('Z')) {
          return moment.utc(timestamp).local();
        }
        
        // Check if it matches ISO format without Z (from Supabase)
        // Example: "2025-08-03T18:52:45.062"
        const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        if (isoPattern.test(timestamp)) {
          // Treat as UTC and convert to local
          return moment.utc(timestamp).local();
        }
      }
      
      // For all other cases, assume it's already local
      return moment(timestamp);
    }

    /**
     * Parse and validate a timestamp
     */
    static isValidTimestamp(timestamp: string | Date): boolean {
      return DateUtils.getMoment(timestamp).isValid();
    }

    /**
     * Format timestamp for database storage (ISO string)
     */
    static toISOString(timestamp?: string | Date | moment.Moment): string {
      if (timestamp) {
        return moment(timestamp).toISOString();
      }
      return moment().toISOString();
    }
  }

  // Legacy functions for backward compatibility - now using moment.js
  export function getTimelineDate(messageDate: Date): string {
    return DateUtils.formatDateSeparator(messageDate);
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
    
    const lastSeenMoment = moment(contact.lastSeen);
    const now = moment();
    
    if (lastSeenMoment.isSame(now, 'day')) {
      return `last seen today at ${lastSeenMoment.format('h:mm A')}`;
    }
    if (lastSeenMoment.isSame(now.clone().subtract(1, 'day'), 'day')) {
      return `last seen yesterday at ${lastSeenMoment.format('h:mm A')}`;
    }

    return `last seen on ${lastSeenMoment.format('MMM D')} at ${lastSeenMoment.format('h:mm A')}`;
  }

  export default DateUtils;