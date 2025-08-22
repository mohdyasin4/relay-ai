/**
 * Google Analytics utilities for RelayAI
 * 
 * Usage:
 * 1. Get your Google Analytics Measurement ID from https://analytics.google.com
 * 2. Replace 'GA_MEASUREMENT_ID' in index.html with your actual ID (e.g., G-XXXXXXXXXX)
 * 3. Use the functions below to track custom events
 */

// Extend window type to include gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * Track a custom event in Google Analytics
 * @param eventName - Name of the event (e.g., 'sign_up', 'message_sent')
 * @param parameters - Additional parameters for the event
 */
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      custom_parameter_1: 'relay_ai',
      ...parameters,
    });
    console.log('Analytics event tracked:', eventName, parameters);
  } else {
    console.log('Analytics not available, would track:', eventName, parameters);
  }
};

/**
 * Track page views (automatically handled by GA, but can be called manually for SPAs)
 * @param pagePath - The page path to track
 * @param pageTitle - Optional page title
 */
export const trackPageView = (pagePath: string, pageTitle?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'GA_MEASUREMENT_ID', {
      page_path: pagePath,
      page_title: pageTitle,
    });
    console.log('Analytics page view tracked:', pagePath, pageTitle);
  }
};

/**
 * Track user authentication events
 */
export const trackAuth = {
  signUp: (method: 'email' | 'google') => trackEvent('sign_up', { method }),
  signIn: (method: 'email' | 'google') => trackEvent('login', { method }),
  signOut: () => trackEvent('logout'),
};

/**
 * Track messaging events
 */
export const trackMessaging = {
  sendMessage: (type: 'text' | 'emoji' | 'mention') => trackEvent('message_sent', { message_type: type }),
  startChat: (chatType: 'direct' | 'group' | 'ai') => trackEvent('chat_started', { chat_type: chatType }),
  joinGroup: () => trackEvent('group_joined'),
  createGroup: () => trackEvent('group_created'),
};

/**
 * Track app interactions
 */
export const trackInteraction = {
  openSettings: () => trackEvent('settings_opened'),
  changeTheme: (theme: string) => trackEvent('theme_changed', { theme }),
  addFriend: () => trackEvent('friend_added'),
  searchUsers: () => trackEvent('user_search'),
};

/**
 * Set user properties (for user identification, optional)
 * @param userId - User ID
 * @param properties - Additional user properties
 */
export const setUserProperties = (userId: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'GA_MEASUREMENT_ID', {
      user_id: userId,
      custom_map: { dimension1: 'user_type' },
      ...properties,
    });
    console.log('Analytics user properties set:', userId, properties);
  }
};

/**
 * React hook for analytics tracking
 */
export const useAnalytics = () => {
  return {
    trackEvent,
    trackPageView,
    trackAuth,
    trackMessaging,
    trackInteraction,
    setUserProperties,
  };
};


