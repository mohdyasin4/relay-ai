import loadable from '@loadable/component';

// Lazy load non-critical components to reduce initial bundle size

// Settings Modal - Only loaded when opened
export const LazySettingsModal = loadable(() => import('./SettingsModal'), {
  fallback: <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
});

// Chat Dialog - Only loaded when opened
export const LazyNewChatDialog = loadable(() => import('./NewChatDialog'), {
  fallback: <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
});

// Edit Group Modal - Only loaded when opened
export const LazyEditGroupModal = loadable(() => import('./EditGroupModal'), {
  fallback: <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
});

// Friend Requests Modal - Only loaded when opened
export const LazyFriendRequestsModal = loadable(() => import('./FriendRequestsModal'), {
  fallback: <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
});

// Invite User Modal - Only loaded when opened
export const LazyInviteUserModal = loadable(() => import('./InviteUserModal'), {
  fallback: <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
});

// Forward Message Modal - Only loaded when opened
export const LazyForwardMessageModal = loadable(() => import('./ForwardMessageModal'), {
  fallback: <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
});

// Lightbox - Only loaded when opened
export const LazyLightbox = loadable(() => import('./Lightbox'), {
  fallback: <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
});

// Emoji Picker - Heavy component, lazy load
export const LazyEmojiPicker = loadable(() => import('./EmojiPicker'), {
  fallback: <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-8 w-16 rounded" />
});

// Large components that might not be used immediately
export const LazyMobileSidebar = loadable(() => import('./MobileSidebar'), {
  fallback: <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
});

// Code blocks - Only load when needed for markdown
export const LazyCodeBlock = loadable(() => import('./ui/code-block'), {
  fallback: <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-20 w-full rounded" />
});

// Chart components - Heavy, only load when needed
export const LazyChart = loadable(() => import('./ui/chart'), {
  fallback: <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-64 w-full rounded" />
});
