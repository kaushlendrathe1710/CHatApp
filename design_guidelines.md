# Design Guidelines: Real-Time Messaging Application

## Design Approach

**Reference-Based Approach** drawing inspiration from established messaging platforms:
- **WhatsApp**: Clean, distraction-free interface with clear visual hierarchy
- **Telegram**: Feature-rich interactions with smooth transitions and modern components
- **Signal/Discord**: Contemporary messaging patterns for group management and media sharing

**Core Principle**: Create an instantly familiar messaging experience that prioritizes readability, speed, and effortless communication while introducing polished, modern design elements.

---

## Typography System

**Primary Font**: Inter (Google Fonts)
- **Message Text**: 15px (regular weight) - optimal for extended reading
- **Contact Names**: 16px (medium weight)
- **Timestamps**: 12px (regular weight, reduced opacity)
- **Section Headers**: 20px (semibold)
- **User Status**: 13px (regular weight)

**Secondary Font**: System UI fallback for performance
- Line height: 1.5 for message text, 1.2 for headers
- Letter spacing: -0.01em for headings, normal for body text

---

## Layout System

**Spacing Primitives**: Tailwind units of **2, 3, 4, 6, 8, 12, 16**
- Message bubbles: p-3 (12px)
- Chat list items: p-4 (16px)
- Section spacing: gap-2 between tight elements, gap-4 for breathing room
- Container padding: px-4 on mobile, px-6 on desktop

**Grid Structure**:
- **Desktop**: Three-column layout (sidebar 280px + chat list 360px + conversation fluid)
- **Tablet**: Two-column (chat list 320px + conversation)
- **Mobile**: Single view with navigation stack

**Container Constraints**:
- Chat list items: Full width with max-w-screen-md
- Message bubbles: max-w-lg (65% of conversation width)
- Media previews: max-w-2xl

---

## Component Library

### Navigation & Structure
**Sidebar (Desktop)**:
- User profile card at top (avatar + name + status)
- Navigation items: Chats, Contacts, Settings, Archived
- Icon + label layout with subtle hover states
- Fixed width, scrollable if needed

**Top App Bar**:
- Contact/Group name (truncated with ellipsis)
- Avatar + online status indicator
- Action buttons: Voice call, video call, menu (aligned right)
- Search icon for in-conversation search
- Height: h-16, border-b for separation

**Chat List Panel**:
- Sticky search bar at top (h-12)
- Scrollable conversation list
- Each item: Avatar (48px) + Name + Last message preview + Timestamp + Unread badge
- Active chat highlighted with subtle background
- Swipe actions on mobile (archive, delete)

### Messaging Components

**Message Bubbles**:
- **Sent messages**: Aligned right, rounded-2xl, tail on bottom-right
- **Received messages**: Aligned left, rounded-2xl, tail on bottom-left
- Border radius: Full rounded except tail corner (rounded-br-sm for sent, rounded-bl-sm for received)
- Padding: py-2 px-3
- Max width constraint to prevent excessive line length
- Consecutive messages from same sender: Reduced spacing (mt-1), remove tail on middle messages

**Message Metadata**:
- Timestamp: Bottom-right corner, text-xs, subtle opacity
- Status indicators: Single check (sent), double check (delivered), blue double check (read)
- Icons: 14px, positioned after timestamp

**Special Message Types**:
- **Image messages**: Rounded corners, max height 400px, caption below
- **File attachments**: Icon + filename + size, download button
- **Voice messages**: Waveform visualization + play button + duration
- **Replies**: Thin left border + preview of original message above

**Date Separators**:
- Centered text on horizontal line
- Text: "Today", "Yesterday", or date format
- Sticky positioning when scrolling

### Input & Interaction

**Message Composer**:
- Fixed at bottom of conversation
- Flexible textarea (min-h-12, max-h-32, auto-expand)
- Emoji picker button (left)
- Attachment button (paperclip icon)
- Send button (only visible when text entered, smooth fade-in)
- Microphone button for voice recording when empty
- Border: border-t with subtle shadow

**Typing Indicator**:
- Appears above message composer
- Animated ellipsis: "John is typing..."
- Small text, gentle fade in/out

### User Elements

**Avatars**:
- Sizes: 48px (chat list), 40px (messages), 32px (group members), 96px (profiles)
- Rounded-full with subtle border
- Online indicator: 12px green dot, positioned bottom-right with border

**Status Messages**:
- Below username in profiles and chat headers
- Italic style, reduced opacity
- Examples: "Available", "Busy", "Custom status text"

**Contact Cards**:
- Avatar (large, 96px)
- Name (text-2xl, font-semibold)
- Phone number or username
- Status message
- Action buttons: Message, Voice call, Video call
- Info sections: Media/files shared, groups in common

### Group Features

**Group Headers**:
- Group avatar (icon grid for first 4 members if no custom image)
- Group name + member count
- Tap to view group info

**Member Management**:
- Scrollable member list with avatars
- Admin badges
- Add member button (prominent)
- Member search

### Modals & Overlays

**Image/Media Viewer**:
- Full-screen overlay with dark backdrop
- Navigation arrows for gallery browsing
- Close button (top-right)
- Caption below image
- Download and forward actions

**Settings Panel**:
- Sectioned list layout
- Toggle switches for notifications, privacy
- Theme selector (Light/Dark/System)
- Profile editing interface

---

## Design Patterns

**Visual Hierarchy**:
- Use subtle shadows for elevation (shadow-sm for chat list, shadow-md for active elements)
- Consistent border usage: border-b for separators, border for input fields
- Depth through layering, not heavy shadows

**Responsive Behavior**:
- Mobile: Full-screen views with slide transitions between chat list and conversation
- Desktop: Split pane with resizable panels
- Breakpoints: Mobile (<768px), Tablet (768-1024px), Desktop (>1024px)

**Micro-interactions**:
- Message send: Slight scale animation on send button
- New message: Smooth slide-in from bottom
- Chat selection: Background color transition
- Online status: Pulse animation on status dot

**Accessibility**:
- Focus indicators on all interactive elements (ring-2 ring-offset-1)
- ARIA labels for icon-only buttons
- Keyboard navigation support (arrow keys in chat list, Enter to send)
- High contrast mode support
- Text resizable without breaking layout

---

## Images

No hero images needed - this is a utility application.

**Required Images**:
- Default avatar placeholder (user silhouette icon)
- Empty state illustrations (no chats selected, no contacts)
- Group avatar grid template (for groups without custom images)

All profile photos, shared media, and attachments are user-generated content.