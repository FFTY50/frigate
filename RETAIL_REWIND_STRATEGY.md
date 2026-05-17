# Retail Rewind — Business Strategy Document

**Prepared for:** Strategic planning discussion
**Context:** This document summarizes a software product concept, its technical foundation,
target market, architecture decisions, and phased build plan. It is intended as a
briefing document for continued business strategy discussion.

---

## What Is Retail Rewind?

Retail Rewind is a purpose-built video surveillance and loss prevention platform
for small to medium convenience store owners and retail operators. It is a
commercial fork of Frigate NVR — a mature, open source network video recorder
with AI-powered object detection — customized specifically for the retail use case.

The core insight driving Retail Rewind: existing surveillance software falls into
two categories that both fail the independent retail operator.

**Enterprise platforms** (Genetec, Milestone, DW Spectrum/NXWitness) are powerful
but expensive, complex to configure, and require dedicated IT staff. A convenience
store owner cannot realistically operate them without a managed services contract.

**Consumer platforms** (Wyze, Ring, Arlo) are easy to use but lack the reliability,
local storage control, retention depth, and AI detection capabilities that a retail
loss prevention use case requires. They are also subscription-dependent with footage
stored exclusively in the cloud — a liability for evidence retention.

Retail Rewind occupies the gap: enterprise-grade AI detection and footage retention,
consumer-grade simplicity, priced and packaged for the independent operator.

---

## The Problem Being Solved

### Primary Problem: Footage Loss
The most expensive thing that happens to a small retailer after an incident —
theft, robbery, slip-and-fall, employee misconduct — is that the footage is gone.

Common causes:
- The NVR hardware was stolen in the same incident (smash-and-grab)
- The hard drive failed and nobody noticed until footage was needed
- The system ran out of storage and overwrote critical footage
- The system was never configured with adequate retention

This is not an edge case. It is the most common reason surveillance footage
cannot be used for insurance claims, police reports, or litigation. For a small
retailer, a single lost-footage incident can mean a denied insurance claim worth
tens of thousands of dollars.

### Secondary Problem: Ease of Use
The store owner and their staff are not security professionals. They need to:
- Quickly verify the store is secure (live view)
- Quickly pull footage of a specific incident (playback by time/date)
- Receive alerts when something flagged occurs
- Share footage with police or insurance without technical knowledge

Current platforms — including open source options like Frigate — are built for
technically proficient users. The interfaces assume familiarity with NVR concepts,
complex filter systems, and non-standard playback controls. This creates friction
at every step for the retail operator.

### Tertiary Problem: Multi-Site Visibility
Operators with more than one location have no affordable, simple way to monitor
all sites from one interface. Enterprise multi-site management systems cost
thousands in licensing. The result is that most small chains treat each location
as an entirely separate system, checking them one at a time — or not at all.

---

## Target Customer

**Primary:** Independent convenience store owners operating 1–5 locations.
- Technically unsophisticated — not IT professionals
- Cost-sensitive — cannot afford enterprise licensing or managed services contracts
- Mobile-first — will access their system primarily from a smartphone
- Motivated by: theft prevention, employee accountability, insurance compliance,
  and liability protection

**Secondary:** Small retail chains (5–20 locations) with a regional manager or
loss prevention coordinator who needs cross-site visibility without enterprise costs.

**Hardware profile of the customer:** Most already have some surveillance hardware.
Many have aging DVR/NVR systems with no AI detection, poor remote access, and
limited cloud backup. Retail Rewind can run on new hardware we provision or
potentially replace aging systems with an upgrade path.

---

## Competitive Landscape

| Platform | Strength | Weakness for retail |
|---|---|---|
| DW Spectrum / NXWitness | Strong mobile, multi-site cloud connect | Expensive licensing, complex setup |
| Genetec / Milestone | Enterprise-grade | Enterprise-priced, requires IT staff |
| Frigate (open source) | AI detection, local control, free | No retail UX, technical audience only |
| Wyze / Ring / Arlo | Easy to use, affordable | Cloud-only storage, limited retention, no LPR |
| Basic DVR/NVR systems | Cheap hardware | No AI, no remote access, no cloud backup |

**Retail Rewind's position:** Takes Frigate's technical foundation (best-in-class
open source AI detection) and wraps it in a retail-appropriate UX and deployment
model. Local-first like DVR systems, AI-capable like enterprise platforms,
simple like consumer products, priced for independent operators.

**Reference UX benchmark:** DW Spectrum's mobile cloud connect experience is the
right model for multi-site access — a simple list of connected NVRs, tap one,
you're in. Retail Rewind adopts this model and adds a cross-site alert thumbnail
feed on top of it.

---

## Technical Foundation

### Base Platform: Frigate NVR 0.17.1
Frigate is an open source NVR licensed under MIT. It is actively maintained
(19,000+ GitHub commits, 0.17.1 released 2026) and provides:

- Multi-camera IP camera support (RTSP, RTMP, HTTP)
- Real-time AI object detection (person, car, and custom labels)
- License plate recognition (LPR)
- Face recognition
- GenAI event descriptions with threat level scoring (0–3)
- Role-based access control with per-camera permissions
- Event review queue with severity tiering (alerts vs. detections)
- Recording retention management
- REST API + WebSocket for real-time data
- Multi-detector backend support: CPU, EdgeTPU, ONNX, OpenVINO, RKNN,
  TensorRT, Hailo8L, and others
- Semantic search with CLIP embeddings
- Audio transcription (Whisper)

Retail Rewind forks Frigate and customizes the frontend UI while keeping the
backend intact. This means Retail Rewind benefits from ongoing upstream
Frigate improvements in detection and AI without maintaining that core infrastructure.

### Why Fork Rather Than Build From Scratch
Frigate's backend represents years of engineering on the hardest parts of the
problem: reliable multi-camera recording, real-time AI inference, storage
management, and hardware abstraction. Building this from scratch would take a
small team 2–3 years and millions in development cost. The open source license
allows commercial use with attribution. The risk is upstream dependency — if
Frigate's direction diverges, the fork becomes the permanent codebase.

---

## Architecture: Local-First with Cloud Access Layer

### Design Philosophy
Video is generated at the edge (the store) and consumed at the edge (the store
owner's phone). Moving video through the cloud adds latency, bandwidth cost, and
a single point of failure. The architecture keeps video local and uses the cloud
only for what the cloud is genuinely good at: identity, access control, metadata
aggregation, and durable storage.

### Local Layer — Each Store
Each Retail Rewind installation runs on a local server at the store:
- Handles all cameras, AI detection, recording, and the full UI
- Serves the complete Retail Rewind interface to any device on the local network
- Runs on two hardware classes (see Hardware Strategy below)
- Stores recent footage locally (5–7 days on Pi, 60–90 days on Dell)
- Pushes detection event clips and thumbnails to Backblaze B2 automatically

### Cloud Access Layer — Cloudflare
Cloudflare provides the bridge between the store's local system and remote users:

**Cloudflare Tunnel (`cloudflared`):**
A lightweight daemon runs on each store's server and creates an outbound-only
encrypted connection to Cloudflare's edge. No open firewall ports. No static IP
required. The store's Retail Rewind UI becomes accessible at a secure URL
(e.g., `store001.retailrewind.com`).

**Cloudflare Access:**
Single sign-on layer in front of all store tunnels. The owner authenticates once
and can access any of their stores. Supports email OTP, Google SSO, and magic
links. Controls which users can access which stores.

**Cloud Dashboard (Cloudflare Pages + Workers + D1):**
A lightweight web app that shows:
- List of all connected store NVRs with online/offline status
- Cross-site thumbnail feed of recent detection events
- Tap a store → opens that store's full local Retail Rewind UI via tunnel
- Tap a thumbnail → deep-links into the relevant event in that store's UI
- When a store is offline: shows last-known thumbnails and offline indicator

The cloud dashboard does NOT serve video. It is a portal and awareness layer only.

### Cloud Storage Layer — Backblaze B2
Backblaze B2 is S3-compatible object storage at approximately 1/5th the cost of
AWS S3. Critically, B2 and Cloudflare have a bandwidth alliance — no egress fees
when B2 traffic flows through Cloudflare's CDN. This makes B2 the economically
correct choice for video clip storage at scale.

**What gets stored in B2:**
- Detection event clips (flagged by AI — not continuous recording)
- Event thumbnails
- Event metadata (camera, timestamp, label, GenAI summary, threat level)

**What stays local only:**
- Continuous recording segments (too large for cost-effective cloud storage)
- Live streams

**Retention:** B2 lifecycle rules auto-expire objects at a configurable period
(30/60/90 days depending on the subscription tier sold).

**Storage cost estimate:** A typical convenience store with 8 cameras generates
roughly 50–200 detection events per day. At an average clip size of 30 seconds
(~15–50MB at 1080p), monthly B2 storage runs approximately $3–10/store/month
at current B2 pricing. This is a cost of goods that scales linearly with
customer count and can be passed through in the subscription price.

### Local Media Proxy
A small service running on each store's server alongside Frigate. It intercepts
media requests from the Retail Rewind UI:
- If the requested clip exists locally → served from local disk (fast, no cloud)
- If the clip has been archived to B2 → returns a redirect to a pre-signed
  Cloudflare/B2 CDN URL

The browser follows the redirect and fetches video directly from B2's CDN.
Video bytes do not route through the local server or the Cloudflare Tunnel.
The store's upload bandwidth is not consumed by archived clip playback.

### Graceful Degradation
When a store's local server is offline or unreachable:
- Live video: unavailable (expected)
- Full Frigate UI: unavailable (expected)
- Cloud dashboard: shows store as offline with last-known thumbnails from B2
- Archived clips: still available via B2 (independent of local server)
- Event history: still queryable from B2/D1 metadata

The most important footage — detection events — is available in B2 regardless
of local hardware state. This directly addresses the footage-loss problem.

---

## Hardware Strategy

Two hardware classes serve different customer segments and store sizes:

### Class 1: ARM (Raspberry Pi 5)
- **Target:** Small stores, 2–4 cameras, budget-conscious operators
- **Storage:** 250GB–1TB USB 3.0 SSD
- **Local retention:** 5–7 days of continuous recording
- **Camera capacity:** 2–4 cameras at 1080p with hardware decode
- **Detection:** CPU-based TFLite or EdgeTPU accelerator add-on
- **Price point:** Hardware cost ~$150–250 fully configured
- **Positioning:** Entry-level, "Basic" subscription tier

### Class 2: x86 PC (Refurbished Dell OptiPlex 3070 or similar)
- **Target:** Larger stores, 4–16 cameras, operators who want extended retention
- **Storage:** 2TB–8TB internal + optional NAS
- **Local retention:** 30–90 days of continuous recording
- **Camera capacity:** 8–16 cameras at 1080p with Intel QuickSync hardware decode
- **Detection:** Intel OpenVINO, ONNX, or optional EdgeTPU/Hailo accelerator
- **Price point:** Hardware cost ~$200–400 refurbished + storage
- **Positioning:** Standard/Pro tier, recommended for most stores

**Key principle:** The software stack is identical on both hardware classes.
The only difference is storage capacity, camera count limits, and local
retention period. A store can upgrade from Pi to Dell without reconfiguring
the system or losing their B2 archive history.

---

## UI Strategy

### The Problem with Frigate's Current UI
Frigate's interface is built for technically proficient users who configure the
system once and understand NVR concepts. For a retail operator who opens the app
10 times per day to check live video and occasionally pull incident footage, the
current UI creates unnecessary friction:

- No visible scrubber/progress bar during video playback
- Live video letterboxes with black bars instead of filling the screen
- Mobile navigation uses icon-only buttons with no text labels
- Calendar/date navigation to find specific footage requires 4–5 taps
- The review timeline is a vertical sidebar — unfamiliar and space-inefficient on mobile
- No concept of a "primary camera" or quick-access favorite
- Five navigation items when retail users need three

### The UI Improvement Plan
A phased UI overhaul of the Frigate frontend (React/TypeScript) targeting the
mobile experience specifically. Priority order:

1. **Visible playback scrubber** — standard progress bar with click/drag seek
2. **Labeled mobile navigation** — text labels under icons, reduced to 4 items,
   renamed to retail-appropriate language ("History" not "Review")
3. **Calendar-first date navigation** — one-tap date access from the History page
4. **Fill mode for live video** — object-cover CSS to eliminate black bars on mobile
5. **Fullscreen fill mode** — true fullscreen without letterboxing
6. **Horizontal mobile timeline** — move the vertical sidebar timeline to a
   collapsible horizontal bar at the bottom on mobile
7. **Primary camera + swipe navigation** — set a default camera, swipe between
   cameras in fullscreen without returning to grid
8. **Performance optimization** — lazy load camera streams, simplify 1,700-line
   component files

### Renaming Strategy
Retail-appropriate language throughout:
- "Review" → "History"
- "Export" → "Saved Clips"
- "Explore" → "Search"
- "Face Library" → "Known Persons"
- "Enrichments" → "AI Features"

### Role System for Retail
Three pre-built roles mapped to Frigate's custom role system:
- **Owner** — full admin access, all cameras, all settings
- **Manager** — all cameras, can view/export/review, cannot change system settings
- **Staff** — assigned cameras only, live view and history read-only

---

## Phased Build Plan

### Phase 1 — Foundation (Current)
- Fork Frigate 0.17.1 into Retail Rewind codebase ✓
- Document full UI map with retail modification notes ✓
- Establish development branch structure ✓

### Phase 2 — Remote Access + Cloud Storage
- Cloudflare Tunnel + Access setup and deployment script
- Backblaze B2 bucket configuration + Cloudflare CDN routing
- B2 Event Sync Service (local daemon, event webhook → B2 upload)
- Local Media Proxy (transparent B2 redirect for archived clips)
- End-to-end test: remote user on mobile, archived clip plays from B2

### Phase 3 — UI Overhaul
- Visible playback scrubber
- Mobile navigation labels + simplification
- Calendar-first date navigation
- Fill mode for live video
- Retail role presets (Owner/Manager/Staff)
- Rename language throughout

### Phase 4 — Cloud Dashboard
- Cloudflare Pages app: store list + online/offline status
- Cross-site thumbnail event feed (pulls from B2/D1)
- Deep-link from thumbnail into store's local UI
- Store registration API (D1)
- Multi-store authentication flow

### Phase 5 — Retail Intelligence (Post-MVP)
- Dwell-time / loitering behavioral rules
- POS transaction correlation
- SMS/escalation notifications (Twilio)
- Shift summary reports
- Store floor plan zone templates

---

## Revenue Model (For Discussion)

Potential subscription tiers (not finalized):

| Tier | Hardware | Cameras | Local Retention | Cloud Archive | Price/mo |
|---|---|---|---|---|---|
| Basic | Pi | Up to 4 | 7 days | 30 days B2 | ~$29–39 |
| Standard | Dell | Up to 8 | 30 days | 60 days B2 | ~$49–69 |
| Pro | Dell | Up to 16 | 90 days | 90 days B2 | ~$79–99 |

Hardware can be sold separately (BYO), bundled at cost, or offered as a lease
component of the subscription. The B2 storage cost (~$3–10/store/month) is the
primary cost of goods for the cloud component and should be reflected in pricing.

---

## Key Risks and Open Questions

1. **Upstream dependency:** Retail Rewind depends on Frigate's backend remaining
   open source and actively maintained. Risk is low given Frigate's community
   size but non-zero.

2. **Hardware support complexity:** Supporting two hardware architectures (ARM and
   x86) increases QA and support surface. Mitigated by identical software stack.

3. **Store internet quality:** Retail stores in some areas have poor or unreliable
   internet. Cloudflare Tunnel requires outbound internet for remote access. B2
   sync requires upload bandwidth. Offline-graceful design mitigates but does not
   eliminate this.

4. **Installer/deployment complexity:** Getting a non-technical store owner from
   hardware-in-a-box to fully running system needs to be as close to zero-touch
   as possible. A one-command install script is required before this is a
   scalable product.

5. **Camera compatibility:** Frigate supports most RTSP-capable IP cameras, but
   compatibility varies. A tested, recommended camera list for retail deployments
   reduces support burden.

6. **Pricing validation:** The subscription tiers above are hypothetical. Customer
   interviews are needed to validate willingness to pay and competitive positioning
   against existing solutions.

---

## Summary Statement

Retail Rewind makes enterprise-grade surveillance accessible to the independent
convenience store operator — local AI detection, cloud-backed footage preservation,
simple mobile interface, and multi-site visibility — at a price point that competes
with consumer platforms and an experience that doesn't require an IT department.

The technical foundation (Frigate 0.17.1) is production-ready. The cloud
infrastructure (Cloudflare + Backblaze B2) is low-cost and proven. The
differentiation is in the UX simplification, the retail-specific workflow design,
and the cloud storage model that solves the footage-loss problem that costs small
retailers thousands of dollars per incident.
