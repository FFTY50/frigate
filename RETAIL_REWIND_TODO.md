# Retail Rewind — Development TODO

## Long-Term Backlog (Post-UI Phase)

These are deferred until the UI foundation is solid:

1. **Dwell-time / loitering behavioral rules** — detect person stationary in zone beyond threshold (e.g., 3 min in aisle); Frigate tracks objects but does not evaluate behavior patterns across time.
2. **POS transaction correlation** — tag video events to register transactions so footage can be pulled by sale ID or transaction time.
3. **Retail-specific dashboard** — incident log (loss events, date, camera, severity, investigator), shift summary reports, and customer traffic heatmaps.
4. **SMS / escalation notifications** — Frigate currently only supports WebPush. Retail staff need SMS (Twilio) and escalation logic (alert → supervisor if unacknowledged within X minutes).
5. **Multi-site central management** — Frigate is single-instance. Chains need a dashboard that aggregates across store locations with per-store user/permission scoping and cloud clip sync.
6. **Convenience store config templates** — pre-built zone templates (entrance, registers 1–4, cooler, backroom), retail-tuned label presets, and alert thresholds calibrated for store traffic noise levels.

---

## Phase 1 — UI Usability (Current Focus)

Frigate is a power-user tool built for technically proficient installers and home automation enthusiasts. Retail users — convenience store owners, clerks, managers — need to open the app and immediately see live video or quickly pull footage from a specific time. The existing UI creates friction at every step for this audience.

Reference target: DW Spectrum / NXWitness mobile experience — clean, fast, gesture-friendly.

---

### Issue 1: Black Bars on Live Video (Aspect Ratio)

**Problem:** All camera feeds are constrained to fixed aspect ratios (`aspect-wide` 32:9, `aspect-tall` 8:9) defined in `tailwind.config.cjs`. On a phone in portrait mode, a 16:9 camera shows massive black bars above and below. There is no "fill" or "cover" mode.

**Files:**
- `web/src/views/live/LiveDashboardView.tsx` (lines 486–516)
- `web/src/tailwind.config.cjs` (lines 41–44)
- `web/src/views/live/LiveCameraView.tsx` (lines 365–397)

**Fix needed:** Add a `object-cover` fill mode option that crops video to fill the container rather than letterboxing. Make fill mode the default for mobile single-camera view; give users a toggle for detail vs. fill in settings.

---

### Issue 2: Fullscreen Still Has Black Bars

**Problem:** Tapping fullscreen triggers browser fullscreen but the video still respects the camera's native aspect ratio. On mobile in landscape, unused screen real estate remains black. Retail users expect fullscreen to mean the video fills the entire display.

**Files:**
- `web/src/views/live/LiveCameraView.tsx` (lines 410–419, orientation lock logic)
- `web/src/components/player/VideoControls.tsx`

**Fix needed:** In fullscreen mode, switch to `object-fit: cover` so video fills the screen. Add a pinch-to-zoom gesture (the underlying library is already imported) so users can still access corners if needed.

---

### Issue 3: No Visible Scrubber / Progress Bar During Playback

**Problem:** The recording/clip player has play/pause, ±10s skip buttons, and speed controls, but **no visible timeline scrubber**. Users cannot see where they are in a clip or click to jump to a specific moment. Scrubbing requires knowing keyboard shortcuts (arrow keys). This is the biggest single UX gap compared to any consumer video app.

**Files:**
- `web/src/components/player/VideoControls.tsx`
- `web/src/components/player/PreviewPlayer.tsx`
- `web/src/components/player/DynamicVideoPlayer.tsx`

**Fix needed:** Add a standard horizontal progress bar below the video with:
- Current time / total duration display
- Click-to-seek on the bar
- Touch-drag scrubbing on mobile
- Thumbnail preview on hover (desktop)

---

### Issue 4: Review Timeline Is Vertical Sidebar — Hard to Use on Mobile

**Problem:** The review/events timeline is a vertical bar on the right side of the screen. While it functions, on mobile it competes with content for screen space and the interaction model (vertical scroll to move through time) is unfamiliar to users who expect a horizontal timeline at the bottom of the screen. There is also no clear indication of what time of day you're currently viewing.

**Files:**
- `web/src/components/timeline/EventReviewTimeline.tsx`
- `web/src/components/timeline/ReviewTimeline.tsx`
- `web/src/views/events/EventView.tsx`

**Fix needed:**
- On mobile, move the timeline to a collapsible horizontal bar at the bottom (swipe up to expand, swipe down to collapse)
- Show a clear current-time indicator (e.g., "2:34 PM") prominently
- Add time-of-day markers (12 AM, 6 AM, 12 PM, 6 PM) visible without scrolling

---

### Issue 5: Calendar Access Is Buried

**Problem:** To view footage from a specific date/time, a user must find and use filter controls that are not prominently placed. The calendar component exists (`components/ui/calendar.tsx`) but is not surfaced in an obvious way from the main review or live view. Getting to "show me footage from yesterday at 2 PM" requires 4–5 taps and assumes the user understands the app's filter model.

**Files:**
- `web/src/components/overlay/ReviewActivityCalendar.tsx`
- `web/src/components/overlay/MobileReviewSettingsDrawer.tsx`
- `web/src/views/events/EventView.tsx`

**Fix needed:**
- Add a persistent, visible date/time picker button on the Review page (not hidden in a settings drawer)
- On tap, open a full-screen calendar with times of day selectable in one step
- Default to "Today" with quick-tap options for "Yesterday", "Last 7 days"
- After selecting, jump directly to that point on the timeline

---

### Issue 6: Mobile Navigation Has No Labels

**Problem:** The bottom navigation bar on mobile uses icon-only buttons with no text labels. New users — the exact audience for a retail product — will not know which icon means "Live," "History," or "Settings." There is also no visual indicator of the active section beyond a subtle color change.

**Files:**
- `web/src/components/navigation/Bottombar.tsx`
- `web/src/components/navigation/NavItem.tsx`

**Fix needed:**
- Add text labels below each nav icon ("Live", "Review", "Search", "Settings")
- Use a clear active-state indicator (filled icon + colored label, not just subtle tint)
- Reduce nav items from 5 to the 3–4 most important for retail: Live, History, Settings (hide Export and Explore behind Settings for now)

---

### Issue 7: Getting to Live View Requires Too Many Steps

**Problem:** The app opens to the camera grid (good), but going from grid → fullscreen single camera → back → different camera is 3+ taps per camera. For a clerk checking an entrance, this is too many steps. There is also no "favorite" or "primary camera" concept.

**Files:**
- `web/src/views/live/LiveDashboardView.tsx`
- `web/src/pages/Live.tsx`

**Fix needed:**
- Add a "primary camera" setting — if set, the app opens directly to fullscreen single-camera live view of that camera
- Swipe left/right between cameras in fullscreen (no need to go back to grid)
- Long-press on a camera in grid to set as primary

---

### Issue 8: Component Complexity / Performance

**Problem:** Core components are extremely large (`LiveCameraView.tsx` is 1,710 lines, `LiveDashboardView.tsx` is 706 lines). All camera streams load simultaneously by default. On a slow mobile connection this causes long load times and stuttering. Fallback between MSE → WebRTC → JSMpeg happens silently, confusing users when quality changes unexpectedly.

**Files:**
- `web/src/views/live/LiveCameraView.tsx`
- `web/src/views/live/LiveDashboardView.tsx`
- `web/src/components/player/LivePlayer.tsx`

**Fix needed:**
- Lazy-load camera streams based on viewport visibility (Intersection Observer is already used — extend the threshold logic)
- Show a simple "Connecting..." state instead of silent fallback
- Long-term: break LiveCameraView into smaller components

---

## Priority Order (Suggested)

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Visible scrubber / progress bar | Medium | High |
| 2 | Mobile nav labels + simplified items | Low | High |
| 3 | Calendar accessible from Review page | Medium | High |
| 4 | Fill mode for live video (no black bars) | Low | High |
| 5 | Fullscreen fill mode | Low | Medium |
| 6 | Timeline to horizontal on mobile | High | Medium |
| 7 | Primary camera + swipe between cameras | Medium | Medium |
| 8 | Performance / lazy load streams | High | Medium |
