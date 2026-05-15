# Retail Rewind — Complete UI Map

Compiled from direct source code reading of Frigate 0.17.1.
Covers every page, view, modal, drawer, menu, and overlay.
Each section includes desktop vs mobile behavior differences and Retail Rewind modification notes.

---

## Navigation Structure

### Desktop — Sidebar (`web/src/components/navigation/Sidebar.tsx`)
- Fixed 52px-wide vertical strip on the left edge.
- Top: Frigate logo (links to `/`). Below it, nav items in order. When on the Live (`/`) route, a `CameraGroupSelector` is injected directly below the Live item.
- Bottom: `GeneralSettings` (gear icon → dropdown) and `AccountSettings` (account icon → dropdown).
- Tooltips appear on hover for each icon.
- Nav items shown: Live, Review, Explore, Export. Face Library and Classification only appear when admin + desktop + feature enabled.

### Mobile — Bottom Bar (`web/src/components/navigation/Bottombar.tsx`)
- Fixed 16px-wide horizontal bar at the bottom. iOS PWA gets extra padding for the home indicator.
- Same nav items as sidebar but icon-only (no text labels), no tooltips.
- Also contains `GeneralSettings` gear button.
- A `StatusAlertNav` warning button appears when there are system issues — tapping opens a bottom Drawer listing problems.

### **Retail Rewind Changes — Navigation**
- Add text labels under each icon in the bottom bar ("Live", "History", "Search", "Settings"). Icon-only navigation is hostile to non-technical retail staff.
- Reduce bottom bar to 4 items: **Live**, **History** (rename from "Review"), **Search** (Explore), **Settings**. Move Export into Settings.
- Remove Face Library and Classification from nav entirely — expose via Settings only.
- Make the active nav item visually obvious (filled icon + colored label, not just a subtle tint change).
- Consider renaming "Review" → "History" throughout — the word "review" means nothing to a store owner. "History" is immediately understood.

---

## 1. Live Page (`/`)

**File:** `web/src/pages/Live.tsx`
Routes between three sub-views based on URL hash:
- `#birdseye` → Birdseye composite view (only if user has full camera access and birdseye is enabled in config)
- `#<cameraName>` → Single camera full view
- (none) → Camera grid dashboard

`f` keyboard shortcut toggles fullscreen on desktop.

---

### 1a. Live Dashboard View (`web/src/views/live/LiveDashboardView.tsx`)

**What it shows:** Grid of all camera live feeds. At the top, a horizontally-scrollable strip of recent alert event cards (last hour) from `AnimatedEventCard`.

**Desktop:**
- Camera grid defaults to `grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4`.
- For named camera groups, switches to `DraggableGridLayout` — cameras can be dragged and resized.
- Fullscreen toggle button in bottom-right corner.
- Right-click any camera → `LiveContextMenu` with options: enable/disable camera, suspend notifications, volume slider, mute/unmute, mute all, stream picker, stats overlay, open streaming dialog, navigate to camera page.
- Camera aspect ratio classes: `aspect-wide` (32:9, col-span-2), `aspect-tall` (8:9, row-span-2), `aspect-video` (16:9). All letterbox with black bars.

**Mobile:**
- Mobile-only header bar: centered Frigate logo, `CameraGroupSelector` (max 45% width), and a layout toggle (grid vs list).
- Default layout is list (single column). User can toggle to 2-column grid.
- No right-click menu (context menu not available on touch — this is a gap).
- No draggable layout on mobile (tablet gets an edit-mode toggle).
- Cameras load via Intersection Observer — cameras outside the viewport are paused.

**Retail Rewind Changes:**
- **Fill mode:** Replace `aspect-*` letterbox classes with `object-cover` fill mode as default on mobile. Offer a toggle in settings for those who prefer letterbox.
- **Primary camera:** Add a "set as primary" option. If set, the app opens directly to that camera's fullscreen view instead of the grid.
- **Swipe between cameras:** In fullscreen single-camera view, swipe left/right to cycle through cameras without going back to the grid.
- **Mobile context menu:** Add a long-press gesture on mobile to open the same options currently only accessible via right-click on desktop.
- **Alert strip:** The animated event card strip at the top is a good retail feature. Keep it but style it more prominently with store-friendly language ("Motion at Register 2", not just a label).
- **Simplify grid layout options:** Hide the camera group / draggable grid complexity from non-admin viewers. Store owners just want to see cameras in a clean grid.

---

### 1b. Single Camera View (`web/src/views/live/LiveCameraView.tsx`)

**What it shows:** Full-screen live feed for one camera with controls overlaid.

**Desktop:**
- Header bar: Back button + "History" button (text labels visible). Right side: admin toggle switches for Enabled, Detect, Record, Snapshots, Audio Detection, Transcription, Autotracking, Manual Recording, Snapshot. Settings cog dropdown: stream selector, audio info, two-way-talk, low-bandwidth reset, background play, stats, debug.
- Pinch/zoom supported via `TransformWrapper`.
- PTZ control panel floats over video when ONVIF is configured — directional arrows, zoom, focus, presets.
- Audio transcription overlay appears as translucent box at bottom-center when enabled.
- Keyboard: `m` = mute, `t` = two-way talk.

**Mobile:**
- Header buttons collapse to icon-only.
- Admin toggles move into a bottom Drawer (cog icon → drawer with `FilterSwitch` rows for all toggles, stream selector, manual recording buttons side-by-side).
- In landscape fullscreen, header buttons rotate to the left edge.
- Screen orientation auto-locks to match camera aspect ratio on fullscreen.

**Retail Rewind Changes:**
- **Fullscreen fill:** In fullscreen mode, switch to `object-fit: cover` so video fills the entire screen.
- **Simplify controls:** Most admin toggles (Detect, Snapshots, Autotracking, etc.) are not relevant to a store clerk viewing live footage. Hide them unless the user is an admin. Show only: mute, fullscreen, and a simple "Report Incident" button.
- **"Report Incident" button:** New retail-specific action. One tap marks the current timestamp, starts a 60-second clip capture, and optionally sends an alert. This is the core loss prevention workflow.
- **History shortcut:** The "History" button already exists. Keep it prominent — this is the second most common action after watching live.
- **PTZ:** Keep PTZ controls but simplify to large tap targets (not the current small arrow buttons) for store owners who may have dome cameras.

---

### 1c. Birdseye View (`web/src/views/live/LiveBirdseyeView.tsx`)

**What it shows:** Composite view of all cameras in a single frame, automatically laid out by Frigate based on camera activity.

**Desktop/Mobile:** Both get Back button and fullscreen/PiP toggles. Clicking a camera region in the birdseye view navigates to that camera's single-camera view. Mobile landscape rotates the header to a vertical column.

**Retail Rewind Changes:**
- Birdseye is useful for managers doing a quick store overview. Keep it but expose it more prominently — consider making it the default opening view when more than 4 cameras are configured.
- Add store floor plan overlay mode (long-term): map camera positions onto a top-down store layout image.

---

## 2. Review / History Page (`/review`)

**File:** `web/src/pages/Events.tsx`
**View:** `web/src/views/events/EventView.tsx`

**What it shows:** Chronological review queue of flagged events, organized by severity.

**Desktop layout:**
- Header: severity toggle group (Alert / Detection / Significant Motion). Right side: filter controls (`ReviewFilterGroup`) — cameras, calendar/date, reviewed toggle, general filters (labels/zones), motion-only toggle.
- Body: grid of `PreviewThumbnailPlayer` cards (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 3xl:grid-cols-4`). Each card shows a preview clip that plays on hover, with a label chip, time-ago badge, and selection ring overlay.
- Right column: `EventReviewTimeline` (vertical, 55–100px wide) + `SummaryTimeline` (10px thin strip).
- Keyboard: Ctrl-A selects all, `r` marks reviewed, Escape clears selection.
- Scroll/pinch on timeline zooms between 60s/30s/10s segment granularity.
- When items are selected, `ReviewFilterGroup` is replaced by `ReviewActionGroup`: selection counter, Unselect, Export (1 item only), Mark reviewed/unreviewed, Delete (admin).

**Mobile layout:**
- Header collapses severity toggle to icons + unread count only. Centered logo.
- Filter controls (`ReviewFilterGroup`) become a single cog button that opens `MobileReviewSettingsDrawer` (bottom drawer with 4 modes: select, export, calendar, filter).
- Timeline column still appears on the right side (dense mode, narrower).
- Swipe-left on a card to mark it as reviewed (via `useSwipeable`).

**PreviewThumbnailPlayer behavior:**
- Desktop: hover activates preview clip playback. Long-press/right-click → context menu.
- Mobile: scroll past → auto-plays. Swipe-left → mark reviewed. Long-press → context menu.

**ReviewActivityCalendar (`web/src/components/overlay/ReviewActivityCalendar.tsx`):**
- Calendar view with dots on days that have activity: red (alert), blue (detection), green (recording).
- Accessible via filter group on desktop, or `MobileReviewSettingsDrawer` calendar mode on mobile. Not surfaced as a primary navigation element.

**Retail Rewind Changes:**
- **Rename:** "Review" → "History" everywhere in this section.
- **Default view:** Alerts only by default (skip showing all detections). Store owners don't need to wade through every motion event.
- **Calendar prominence:** Move the calendar to a visible button in the main header, not buried in a drawer or filter group. Retail users think in terms of "show me Tuesday afternoon," not "filter by date range."
- **Timeline orientation (mobile):** Move the vertical right-side timeline to a collapsible horizontal bar at the bottom on mobile. Show the current time of day prominently (e.g., "2:34 PM"). Add 4 quick time markers (12 AM, 6 AM, 12 PM, 6 PM) visible without scrolling.
- **Swipe-to-review:** Keep the swipe-left gesture — it's a good mobile interaction. Also add swipe-right for "flag for follow-up" (a retail-specific action that doesn't exist in Frigate).
- **Threat level display:** Surface the GenAI threat level (0–3) visually on each card (e.g., colored border: green=0, yellow=1, orange=2, red=3). This helps staff triage quickly.
- **Significant Motion tab:** Hide this from non-admin viewers. Store owners don't need raw motion data — only flagged events matter.
- **"Report to Manager" action:** Add to the card context menu and `ReviewActionGroup`. Sends a notification to the manager role about a specific event.

---

### 2a. Recording / Playback View (`web/src/views/recording/RecordingView.tsx`)

**What it shows:** Full footage player for a selected camera + time range, with a timeline for navigating through recorded segments.

**Desktop layout:**
- Header: Back, Live (jump to camera live view), camera switcher, Export dialog, filter group, timeline-type toggle (Timeline / Events / Detail).
- Body: `flex-row`. Left: main `DynamicVideoPlayer` + row of `PreviewPlayer` thumbnails for other cameras below (or to the side for tall-aspect cameras). Right: timeline column (width varies: 100px for timeline, 320px for events, 480–720px for detail).
- `GenAISummaryChip` floats over the video on desktop/tablet — tap to open `GenAISummaryDialog` (AI threat-level analysis with title, description, and structured activity breakdown).
- Detail view: `DetailStream` — AI transcripts, object metadata, event classification.
- Events view: scrollable list of `ReviewCard` (individual event segments).

**Mobile layout:**
- Header collapses to: Back, Live (icon-only), `MobileCameraDrawer` trigger, `MobileTimelineDrawer` trigger, `MobileReviewSettingsDrawer` trigger.
- Body: `flex-col` (stacked vertical), switches to `flex-row` in landscape.
- Timeline expands to full width in portrait. GenAI summary chip moves above the timeline column.
- No secondary camera thumbnails row on mobile portrait.

**`DynamicVideoPlayer` / `VideoControls.tsx`:**
- Controls: Play/Pause, seek ±10s, volume slider, playback rate (0.5/1/2 on Safari; 0.5/1/2/4/8/16 elsewhere), Frigate+ frame upload, fullscreen.
- **No visible progress bar / scrubber.** HTML5 native scrubber may appear depending on browser, but no custom Frigate timeline bar is present in the controls.
- Keyboard: Space=play/pause, arrows=seek ±1s/±10s.

**Retail Rewind Changes:**
- **Add a visible progress bar scrubber.** This is the single most critical missing UX element. Standard bar: current time / total duration, click-to-seek, touch-drag on mobile, thumbnail preview on hover (desktop). This is what every consumer video app has and what users expect.
- **"Jump to incident" mode:** When opened from a specific event card, auto-play from 30 seconds before the event start and highlight the event segment on the progress bar.
- **Simplify timeline types:** The three-mode toggle (Timeline / Events / Detail) is confusing. Default to Timeline. Put Events and Detail behind an expandable "More info" panel.
- **GenAI Summary:** Keep the `GenAISummaryChip` — this is excellent retail value. Style it more prominently (not just a small floating pill) and surface the threat level color prominently.
- **Camera switcher:** The `MobileCameraDrawer` is good — keep it. Consider showing a small thumbnail of each camera's current frame in the switcher list.
- **Export:** Simplify export to one action: "Save Clip" with a sensible default (the current event ±30s). The current export dialog (hours-back radio, custom range, timeline selection) is too complex for a store owner.

---

## 3. Explore / Search Page (`/explore`)

**File:** `web/src/pages/Explore.tsx`
**View:** `web/src/views/explore/ExploreView.tsx` + `web/src/views/search/SearchView.tsx`

**What it shows:** Semantic search and browsable object library. Requires `semantic_search.enabled` in config.

**Desktop layout:**
- Shows a loading/setup screen if CLIP models are still downloading (animated progress bars, per-model status).
- Summary mode: rows of thumbnails grouped by detected label (person, car, etc.). Max 10 per row on desktop, 5 on mobile. "More →" arrow links to filtered search for that label.
- Grid mode: infinite scroll of all tracked objects.
- Search input allows text queries (semantic search) or filters.
- `SearchDetailDialog` (two-column dialog): left = snapshot/thumbnail, right = tracking details tab (object path SVG, transcripts, AI metadata).
- Right-click thumbnail → `SearchResultActions` context menu: Download video, Download snapshot, Find similar, Show tracking details, Add trigger (admin), View in history (admin), Submit to Frigate Plus, Delete (admin).

**Mobile layout:**
- Grid forced to 2 columns.
- `SearchDetailDialog` becomes a `MobilePage` (full-screen, stacked layout).
- Context menu becomes a tap-triggered `DropdownMenu` kebab button.
- TimeAgo badge is desktop-only.

**`SearchFilterDialog`** (accessible from search header):
- Cameras (command-search list), labels, sub-labels, attributes, license plates, zones, date range, time range, score range slider, speed range slider, has-snapshot/has-clip/is-submitted switches, search type toggle (semantic/similarity), sort toggle.

**Retail Rewind Changes:**
- **Rename:** "Explore" → "Search" — it's more intuitive.
- **Surface LPR prominently:** For convenience stores, license plate search is a primary loss prevention tool. Add a dedicated "Search by License Plate" quick-filter button in the header (not buried in the full filter dialog).
- **Person search with face recognition:** Add a "Search by Person" mode that uses face recognition to show all events involving a specific identified person.
- **Simplified filter dialog:** The current `SearchFilterDialog` has ~12 filter controls. For retail, the most useful are: date/time, camera, and label (person/car). Reduce the default view to these three with an "Advanced" expand.
- **"Find Similar" for loss prevention:** The semantic search "Find Similar" feature is directly useful for pattern-matching theft behavior. Surface it more prominently — "Similar Incidents" as a quick action on every event card.
- **Remove or hide:** Sub-labels, attributes, speed range, is-submitted (Frigate+) from the default retail UI.

---

## 4. Exports Page (`/export`)

**File:** `web/src/pages/Exports.tsx`

**What it shows:** Library of saved video clips that have been manually exported.

**Desktop:**
- Search input (1/3 width). Grid of `ExportCard` (`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`).
- Click a card → playback dialog (max-width scales with screen size).
- Delete → `AlertDialog` confirmation.

**Mobile:**
- Search input is full width.
- Fewer grid columns.
- Playback dialog adjusts to `landscape:max-w-[60%]`.

**Retail Rewind Changes:**
- **Rename:** "Export" → "Saved Clips" — more intuitive for retail users.
- **Move to Settings or secondary nav:** Most store owners won't use this daily. Remove from the primary bottom nav and access via Settings or a "My Saved Clips" link in History.
- **Add metadata:** Show which camera, which date/time, and why it was saved (incident note) on each card. Currently shows just a filename/thumbnail.
- **Share clip:** Add a "Share" button that generates a time-limited link to the clip (useful for sharing with police or management). Long-term feature.

---

## 5. Settings Page (`/settings`)

**File:** `web/src/pages/Settings.tsx`

12 sub-pages, grouped into 6 visual categories. Viewer role is limited to 3 pages (UI, Debug, Notifications).

**Desktop layout:**
- Header with page title + optional camera selector (DropdownMenu on desktop).
- Left: Radix `Sidebar` with grouped menu entries.
- Right: `SidebarInset` renders the active view.

**Mobile layout:**
- Two-screen flow: First screen = scrollable list of `MobileMenuItem` rows (chevron-right), grouped by category. Tap a row → full-screen `MobilePage` overlay slides in with header (back button + title) and the view content.
- Camera selector becomes a bottom `Drawer` on mobile.

### Settings Sub-pages:

#### UI Settings (`UiSettingsView.tsx`)
- Auto live switch, play alert videos switch, display camera names switch, live fallback timeout (1–10s).
- Clear stored layouts button, clear camera group streaming button.
- Default playback rate (rate-limited on Safari).
- Calendar first weekday select.
- **Retail Rewind:** Add retail-specific UI toggles: fill mode (vs letterbox), primary camera selector, show/hide nav items, store name/location display.

#### Camera Management (`CameraManagementView.tsx`)
- List of cameras with enable/disable switches. "Add Camera" → `CameraWizardDialog`. Edit → `CameraEditForm`.
- **Retail Rewind:** Add retail zone templates (entrance, register 1–4, cooler, backroom) to the camera setup wizard as one-click presets.

#### Camera Review Settings (`CameraReviewSettingsView.tsx`)
- Per-camera: which labels trigger alerts vs detections, which zones are required.
- **Retail Rewind:** Pre-populate with retail defaults: alerts = person + car; required zones = entrance or register areas. Add a "retail preset" button.

#### Enrichments (`EnrichmentsSettingsView.tsx`)
- Switches for semantic search, face recognition, LPR, bird classification. Model size selects. Reindex confirmation.
- **Retail Rewind:** Reorder: LPR first (most retail-relevant), face recognition second, semantic search third. Bird classification is irrelevant — hide it. Rename "Enrichments" → "AI Features."

#### Masks & Zones (`MasksAndZonesView.tsx`)
- Canvas-based polygon editor for drawing zones and motion masks. `ZoneEditPane`, `MotionMaskEditPane`, `ObjectMaskEditPane`.
- **Retail Rewind:** Add the retail zone templates here as a one-click overlay (pre-draw common store zones as a starting point). This removes a major technical barrier for non-technical store owners.

#### Motion Tuner (`MotionTunerView.tsx`)
- Sliders for motion threshold (5–80) and contour area (5–100), improve-contrast switch. Live preview of motion overlay on camera.
- Desktop: side-by-side. Mobile: stacked.
- **Retail Rewind:** Hide from viewer role. Add a "Recommended for convenience store" default preset button that sets tuned values for typical store lighting conditions.

#### Notifications (`NotificationsSettingsView.tsx`)
- Per-camera enable toggle, email field, suspend countdown, test button.
- **Retail Rewind:** Add SMS/Twilio option here (long-term). Add role-based routing: "Alert staff" vs "Alert manager" vs "Alert owner." Add cooldown-by-time-of-day (e.g., different sensitivity during open vs closed hours).

#### Object Settings / Debug (`ObjectSettingsView.tsx`)
- Debug overlay toggles (bounding boxes, timestamp, zones, mask, motion, regions, paths). Object list tabs. Audio level graph. Live camera image with overlays.
- **Retail Rewind:** Keep debug for admin. Rename "Debug" → "Camera Debug" to be more descriptive. Hide from viewer role (already enforced).

#### Triggers (`TriggerView.tsx`)
- Table of semantic search triggers per camera with type, threshold, action badges. Add trigger → `TriggerWizardDialog`. Edit/delete per row.
- **Retail Rewind:** Pre-build retail trigger templates: "Person loitering near exit," "Person near register for extended period," "Vehicle parked at entrance." These would auto-create triggers with sensible defaults.

#### Users (`UsersView.tsx` / `AuthenticationView.tsx`)
- Table of users: username, role badge, Change role / Set password / Delete buttons (labels hide on small screens).
- **Retail Rewind:** Add role presets: "Owner" (full admin), "Manager" (view all cameras, export, manage staff), "Staff" (view assigned cameras only, no settings). These map to Frigate's custom role system.

#### Roles (`RolesView.tsx` / `AuthenticationView.tsx`)
- Table of roles: role name, camera badge (shows count or "All cameras"). Edit cameras / Delete buttons.
- **Retail Rewind:** Surface this more prominently — role-based camera access is essential for multi-staff stores. Add "Store preset roles" one-click button.

#### Frigate+ (`FrigatePlusSettingsView.tsx`)
- Model selection, metadata display.
- **Retail Rewind:** Likely hide or de-emphasize. Retail users are unlikely to subscribe to Frigate+.

---

## 6. Face Library Page (`/faces`)

**File:** `web/src/pages/FaceLibrary.tsx`
Admin + desktop only (hidden from mobile nav).

**What it shows:** Grid of enrolled faces for recognition. Training tray + named face collections.
Controls: Upload Image, Add Face (`CreateFaceWizardDialog` — 3-step wizard), Select/Delete. Keyboard: Ctrl-A select all, Escape clear.

**Retail Rewind Changes:**
- Make accessible on mobile (currently desktop-only nav restriction). Store owners may need to enroll known shoplifters from their phone.
- Rename "Face Library" → "Known Persons" — more retail-appropriate language.
- Add categories: "Staff" (ignored in alerts), "Flagged" (always alert), "VIP" (optional).
- Add "Flag for Alert" action — when a recognized face is flagged, trigger an immediate notification next time they enter.

---

## 7. Classification Page (`/classification`)

**File:** `web/src/pages/ClassificationModel.tsx`
Admin + desktop only.

**What it shows:** Custom ONNX model management. `ModelSelectionView` (browse/select models) or `ModelTrainingView` (train a model on labeled events).

**Retail Rewind Changes:**
- Keep as-is for now (advanced feature). Long-term: add retail-specific model presets (shoplifting behavior model, shelf occupancy model).

---

## 8. System Page (`/system`)

**File:** `web/src/pages/System.tsx`

**What it shows:** Four metric sub-views selectable via header toggle: General / Enrichments / Storage / Cameras.
- Enrichments tab only shown when relevant features are enabled.
- Mobile: centered logo in header; toggle labels hidden (icon-only).
- Right side: last-refreshed timestamp.

**Retail Rewind Changes:**
- Show storage remaining prominently — retail users need to know when they're about to lose footage retention.
- Add a "System Health" plain-language status (e.g., "All cameras online," "1 camera offline") instead of raw metrics.
- Hide "Enrichments" from viewer role — already partially enforced.

---

## 9. Logs Page (via Settings gear)

**File:** `web/src/pages/Logs.tsx`

**What it shows:** Live log stream for frigate, nginx, go2rtc. Log service tabs (horizontally scrollable). Copy/Download buttons. Row click → `LogInfoDialog` (Sheet on desktop, Drawer on mobile) with parsed log details and doc links.

**Retail Rewind Changes:**
- Hide from all non-admin roles. This is a technical tool that serves no retail purpose. Currently accessible via the gear menu — gate it to admin only.

---

## 10. Login Page (`/login`)

**File:** `web/src/pages/LoginPage.tsx`

Centered card with Frigate logo and `UserAuthForm`. No nav, no sidebar.

**Retail Rewind Changes:**
- Replace Frigate logo with Retail Rewind logo/branding.
- Add store name/location display ("Welcome — Main St Location").
- Consider PIN-based login as an option for shared devices (4-digit PIN is faster than username/password for a clerk checking cameras quickly).

---

## 11. Modals, Drawers & Overlays

### Export Dialog (`web/src/components/overlay/ExportDialog.tsx`)
- Desktop: `Dialog`. Mobile: drawer within `MobileReviewSettingsDrawer`.
- Controls: hours-back radio (1/4/8/12/24h) or custom date range via `TimezoneAwareCalendar`, timeline mode selector, Save Export button.
- On mobile, `SaveExportOverlay` banner appears at top of screen during export range selection.
- **Retail Rewind:** Simplify to: "Save last 2 minutes / 5 minutes / Custom" with one tap. The current date-picker-based export flow requires too many steps for a staff member acting on a live incident.

### Review Activity Calendar (`web/src/components/overlay/ReviewActivityCalendar.tsx`)
- Calendar with colored day decorators: red dot = alerts, blue = detections, green = recordings.
- Currently accessed via filter group (desktop) or drawer (mobile) — not a primary UI element.
- **Retail Rewind:** Make this a first-class navigation element. "Pick a day" should be one tap from the History page.

### Mobile Review Settings Drawer (`web/src/components/overlay/MobileReviewSettingsDrawer.tsx`)
- Bottom drawer with 4 modes: `select` (shows Export/Calendar/Filter buttons), `export`, `calendar`, `filter`.
- **Retail Rewind:** Reorganize modes to: `calendar` (default), `filter` (simplified), `export`. Rename trigger button from a cog to a calendar icon.

### GenAI Summary Chip & Dialog (`web/src/components/chip/GenAISummaryChip.tsx`)
- Small floating pill over the video player in RecordingView. Opens `GenAISummaryDialog`.
- Dialog shows AI-generated threat level (0–3), title, description, structured activity breakdown.
- Desktop: `Dialog`. Mobile: `Drawer`.
- **Retail Rewind:** This is one of the highest-value features for retail. Make the chip more visible (not just a small pill) and color it by threat level (green/yellow/orange/red). Consider showing a one-line AI summary directly on the event card in History view — no tap required to see the gist.

### PTZ Control Panel (`web/src/components/overlay/PtzControlPanel.tsx`)
- Floating overlay with directional arrows, zoom in/out, focus, presets dropdown, click-to-move toggle.
- **Retail Rewind:** Enlarge tap targets significantly — small arrow buttons are hard to use on mobile. Consider a virtual joystick instead of discrete arrow buttons.

### Status Alert Nav (Bottombar)
- Warning indicator in bottom bar when system issues exist. Tap → bottom Drawer listing problems with links.
- **Retail Rewind:** Replace technical error language with plain language ("Camera 2 is offline — check the cable" instead of "RTSP connection failed"). Add a "Call for help" link if configured.

### Search Detail Dialog (`web/src/components/overlay/detail/SearchDetailDialog.tsx`)
- Desktop: two-column Dialog (60% snapshot / 40% tracking details). Mobile: full-screen `MobilePage` (stacked).
- Tabs: snapshot/thumbnail, tracking details. Navigation arrows on desktop only.
- `DetailActionsMenu` dropdown: Download Video, Download Snapshot, Find Similar, Submit to Plus, View in History, View Tracking Details, Delete.
- **Retail Rewind:** Add "Report Incident" to `DetailActionsMenu`. Add "Share with Manager" (sends notification or generates a link). Remove "Submit to Plus" from the default menu.

### Platform-Aware Dialog (`web/src/components/overlay/dialog/PlatformAwareDialog.tsx`)
- Renders as `Drawer` on mobile, `Popover` on desktop.
- `PlatformAwareSheet`: `Sheet` on desktop, `MobilePage` on mobile.
- Used throughout for consistent cross-platform modal behavior.

### Camera Info Dialog (`web/src/components/overlay/CameraInfoDialog.tsx`)
- Shows raw `ffprobe` stream metadata. Admin/debug use.
- **Retail Rewind:** Hide from non-admin roles. Irrelevant to store owners.

---

## 12. Context Menus

### Live Context Menu (`web/src/components/menu/LiveContextMenu.tsx`)
Right-click on a camera in the live grid (desktop only).
- Items: enable/disable camera, suspend/resume notifications, volume slider, mute/unmute, mute all/unmute all, stream picker, stats overlay, open streaming dialog, navigate to camera page.
- **Retail Rewind:** Long-press on mobile should open the same menu. Prioritize items: View Fullscreen, View History, Mute/Unmute. Move admin-only items (enable/disable, stream picker) behind an "Advanced" submenu.

### Search Result Actions (`web/src/components/menu/SearchResultActions.tsx`)
Right-click (desktop) or kebab button (mobile) on Explore thumbnails.
- Items: Download Video, Download Snapshot, Find Similar, Show Tracking Details, Add Trigger, View in History, Submit to Plus, Delete.
- **Retail Rewind:** Prioritize: View in History, Find Similar, Download Video. Add "Report Incident." Move Delete and Submit to Plus to an "Advanced" section.

### General Settings Menu (`web/src/components/menu/GeneralSettings.tsx`)
Gear icon → DropdownMenu (desktop) or Drawer (mobile).
- Items: Settings, System, Logs, Language, Theme, Documentation, Classification, Restart Frigate, Logout.
- **Retail Rewind:** Simplify to: Settings, System Health (rename from "System"), Help, Logout. Remove: Language (set at install time), Documentation (link to Retail Rewind docs instead), Classification, Restart Frigate (admin only, move to Settings).

---

## 13. Desktop vs Mobile Behavior — Master Reference

| Element | Desktop | Mobile |
|---|---|---|
| Navigation | Left sidebar (52px, icon + tooltip) | Bottom bar (icon-only, no tooltips) |
| Settings | Sidebar + SidebarInset (two-column) | Two-screen list → MobilePage |
| Camera grid | Draggable layout for groups | Grid/list toggle, no drag |
| Single camera controls | Header row of toggle switches | Bottom drawer via cog |
| Context menus | Right-click | Swipe gesture / long-press / kebab |
| Modals | Dialog | Drawer or MobilePage |
| Sheets | Sheet (side panel) | MobilePage (full screen) |
| Dropdowns | DropdownMenu / Popover | Drawer |
| Button labels | Visible text | Icon-only (text hidden) |
| Tooltips | Radix tooltip on hover | None |
| Nav item labels | Shown via tooltip | None (icons only) |
| Face Library | Accessible (admin) | Hidden from nav |
| Classification | Accessible (admin) | Hidden from nav |
| Timeline detail | Separate column (320–720px) | Full width below video |
| GenAI chip | Floats over video | Above timeline column |
| Search detail | Two-column dialog | Full-screen MobilePage |
| Face wizard | Dialog | MobilePage |
| Export dialog | Dialog | Embedded in settings drawer |
| Calendar | Popover/dialog | Drawer |
| PTZ controls | Small arrow buttons | Same (needs enlargement) |
| Picture-in-picture | Supported | Disabled on iOS/Firefox |
| Fullscreen | Browser fullscreen | Browser fullscreen + orientation lock |
| Keyboard shortcuts | Full set (f, m, t, r, Ctrl-A, arrows) | None |

---

## 14. Role-Based Access Summary (Current Frigate)

| Feature | Admin | Custom Role (with cameras) | Viewer |
|---|---|---|---|
| Live — all cameras | Yes | Assigned cameras only | All cameras |
| Review/History | Yes | Yes | Yes |
| Explore/Search | Yes | Yes | Yes |
| Exports | Yes | Yes | Yes |
| Face Library | Yes (desktop) | No | No |
| Classification | Yes (desktop) | No | No |
| Settings — UI | Yes | Yes | Yes |
| Settings — Debug | Yes | Yes | Yes |
| Settings — Notifications | Yes | Yes | Yes |
| Settings — all others | Yes | No | No |
| Delete events | Yes | No | No |
| Export clips | Yes | No | No |
| Camera enable/disable | Yes | No | No |
| User management | Yes | No | No |

### **Retail Rewind Role Additions:**
| Retail Role | Based On | Additions |
|---|---|---|
| Owner | Admin | Full access. Sees all cameras, all settings, all reports |
| Manager | Custom (all cameras) | Can view all cameras, export clips, view History, mark reviewed. Cannot change system settings or manage users |
| Staff | Custom (assigned cameras) | Can view assigned cameras (live only). History is read-only. No settings access |

---

## 15. Key Files Quick Reference

| Area | Primary File |
|---|---|
| App entry + routing | `web/src/App.tsx` |
| Nav items definition | `web/src/hooks/use-navigation.ts` |
| Desktop sidebar | `web/src/components/navigation/Sidebar.tsx` |
| Mobile bottom bar | `web/src/components/navigation/Bottombar.tsx` |
| Live grid | `web/src/views/live/LiveDashboardView.tsx` |
| Single camera live | `web/src/views/live/LiveCameraView.tsx` |
| Review / History | `web/src/views/events/EventView.tsx` |
| Video playback | `web/src/views/recording/RecordingView.tsx` |
| Video controls | `web/src/components/player/VideoControls.tsx` |
| Explore / Search | `web/src/views/explore/ExploreView.tsx` |
| Review timeline | `web/src/components/timeline/EventReviewTimeline.tsx` |
| Calendar overlay | `web/src/components/overlay/ReviewActivityCalendar.tsx` |
| Mobile review drawer | `web/src/components/overlay/MobileReviewSettingsDrawer.tsx` |
| GenAI chip | `web/src/components/chip/GenAISummaryChip.tsx` |
| Platform-aware modal | `web/src/components/overlay/dialog/PlatformAwareDialog.tsx` |
| Settings page | `web/src/pages/Settings.tsx` |
| General settings menu | `web/src/components/menu/GeneralSettings.tsx` |
| Live context menu | `web/src/components/menu/LiveContextMenu.tsx` |
| Search actions menu | `web/src/components/menu/SearchResultActions.tsx` |
| Tailwind config | `web/tailwind.config.cjs` |
