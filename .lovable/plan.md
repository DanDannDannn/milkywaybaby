
## Baby Feed & Diaper Tracker

A mobile-friendly webapp for new parents to log feedings and diaper changes, shareable across caregivers.

### Auth & Sharing
- **Email/password registration & login** via Lovable Cloud
- After signup, user either **creates a baby** (name, birth date, photo optional) or **joins one with an invite code**
- Each baby has a 6-character invite code; from the baby's settings page caregivers can copy/share it
- A user can belong to multiple babies; an active baby is selected in the header

### Home Page (mobile-first)
- Header: baby name + avatar, switcher if multiple babies
- Two summary cards:
  - 🍼 **Last feeding** — "2h 15m ago • 90ml formula"
  - 🧷 **Last diaper change** — "45m ago • wet"
- Two large CTA buttons: **"Log feeding"** and **"Log diaper"**
- Quick link to History

### Log Feeding
- Time picker (defaults to now, editable)
- Amount (number) + unit toggle (ml / oz)
- Type: Breast milk / Formula
- Optional note
- Save → returns to home

### Log Diaper
- Time picker (defaults to now, editable)
- Type selector: Wet / Dirty / Mixed
- Optional note
- Save → returns to home

### History Page
- **Weekly calendar strip** at top (7 days, swipeable, current day highlighted)
- Tap a day → chronological list for that day mixing feedings and diapers with icons, time, and details
- Daily summary chip: total ml, # feedings, # diapers
- Tap any entry to **edit or delete**

### Visual Style
Soft pastel & friendly — peach, mint, soft blue accents on cream background, rounded cards, gentle shadows, large tap targets suited for one-handed phone use during night feeds.

### Data Model (Lovable Cloud)
- `babies` (id, name, birth_date, invite_code, created_by)
- `baby_members` (baby_id, user_id, role) — enables multi-caregiver sharing with RLS
- `feedings` (id, baby_id, occurred_at, amount, unit, type, note, logged_by)
- `diapers` (id, baby_id, occurred_at, type, note, logged_by)
- RLS: users can only access babies they're a member of
