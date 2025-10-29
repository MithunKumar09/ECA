# Notification Bell Integration for Static HTML Pages

## Summary
Added a fixed animated notification bell icon to all static HTML pages, positioned above the scroll-to-top button. The component uses the same notification logic as the React NavBar component.

## Changes Made

### 1. Created Notification Bell Component
- **File**: `mygf/src/components/home/StaticNotificationBell.tsx`
  - React component version of the notification bell (for future React integration if needed)

### 2. Created Standalone JavaScript Implementation
- **File**: `mygf/public/static/notification-bell-standalone.js`
  - Standalone JavaScript implementation that works on static HTML pages
  - Fetches notifications from `/api/notifications/list` endpoint
  - Shows unread count badge with animation when there are unread notifications
  - Opens a dropdown panel when clicked showing all notifications
  - Handles marking notifications as read and dismissing them

### 3. Updated All Static HTML Files (62 files total)
All static HTML files in `mygf/public/static/` have been updated to include:
1. A mount point div: `<div id="notification-bell-mount"></div>` placed above the scrollup button
2. A script loader that loads the standalone notification bell JavaScript file

## Features

### Visual Features
- Fixed position: 90px from bottom, 20px from right (above the scroll-to-top button)
- Circular white button with bell icon
- Red badge showing unread count (9+ for counts > 9)
- Pulsing animation when there are unread notifications
- Dropdown panel opens on click showing all notifications
- Backdrop overlay when dropdown is open

### Functional Features
- Auto-fetches notifications on page load
- Polls for updates every 60 seconds
- Mark as read functionality
- Dismiss notification functionality
- Navigate to course when clicking "Open" on notification
- Uses same API endpoints as the React app

## How It Works

1. **Mount Point**: Each static HTML page has a `<div id="notification-bell-mount"></div>` element
2. **Initialization**: On page load, a script loads `notification-bell-standalone.js`
3. **Fetching**: The standalone script fetches notifications from `/api/notifications/list?unreadOnly=true&limit=20`
4. **Display**: Shows a bell icon with badge count when there are unread notifications
5. **Interaction**: Clicking the bell opens a dropdown panel with all notifications
6. **Actions**: Users can "Open" (navigate to course) or "Dismiss" notifications

## Positioning

The notification bell is positioned:
- **Fixed**: 90px from bottom, 20px from right
- **Stacking**: z-index 9998 (below dropdown which is 9999)
- **Above**: The scroll-up button which is at 20px from bottom

## API Endpoints Used

- `GET /api/notifications/list?unreadOnly=true&limit=20` - Fetch notifications
- `POST /api/notifications/{id}/read` - Mark notification as read
- `POST /api/notifications/{id}/dismiss` - Dismiss notification

## Styling

The notification bell uses inline styles to avoid conflicts with existing CSS. Key styles:
- White circular button with subtle shadow
- Red badge for unread count
- Pulsing animation (opacity 0.7 to 1.0 every 2 seconds)
- Responsive dropdown panel (max-width: calc(100vw - 40px))

## Testing

To test the notification bell:
1. Start the development server
2. Navigate to any static HTML page (e.g., `/static/home.html`)
3. Log in as a user with notifications
4. The bell should appear in the bottom-right corner above the scroll-up button
5. If there are unread notifications, the bell will pulse and show a red badge
6. Click the bell to see the dropdown with all notifications

## Files Modified

### New Files
- `mygf/src/components/home/StaticNotificationBell.tsx`
- `mygf/public/static/notification-bell-standalone.js`

### Modified Files
- All 62 static HTML files in `mygf/public/static/`:
  - Added mount point div
  - Added script loader

### Unchanged Files (Notification Logic)
- `mygf/src/components/notifications/NotificationBell.tsx` (existing)
- `mygf/src/hooks/useNotifications.tsx` (existing)
- `mygf/src/components/home/NavBar.tsx` (existing)
