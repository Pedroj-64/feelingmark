# Design System: Feelingmark

## 1. Visual Theme & Atmosphere
A quiet, paper-warm photo journal. Daily-app balanced density (4), offset asymmetric layouts (variance 6) and fluid spring motion (5). The interface steps back so the photos lead: it feels like a well-kept printed diary, not a social feed. Calm, personal, never noisy. Phone-first; the web client is the same screens with more breathing room.

## 2. Color Palette & Roles
Light:
- **Paper** (#F7F4EF) — app background
- **Linen** (#FFFFFF) — sheets, modals, inputs
- **Ink** (#1F1B16) — primary text (warm off-black, never #000)
- **Stone** (#756E66) — secondary text, weekday labels, metadata
- **Hairline** (rgba(31,27,22,0.10)) — 1px dividers and borders
- **Ember** (#B65136) — the single accent: today marker, primary action, focus ring, days with memories

Dark:
- **Night Paper** (#16130F) background · **Soot** (#211D18) surfaces · **Bone** (#F2EDE4) text · **Ash** (#A39B8F) secondary · **Ember Glow** (#E07A5C) accent

One accent only, saturation under 80%. No purple, no neon, no gradients on text.

## 3. Typography Rules
- **Display (month and day titles only):** Fraunces — soft editorial serif, tight tracking, used sparingly
- **UI & body:** Geist — relaxed leading, max 65ch, hierarchy by weight and color rather than size
- **Mono (dates, counts, EXIF):** Geist Mono
- **Banned:** Inter, Times/Georgia/Garamond, any serif inside settings or data-heavy screens

## 4. Component Stylings
* **Calendar day cell:** square, 12px radius. With photos: the day's first photo fills the cell with a small count badge in Geist Mono; empty days show only the number in Stone; today gets an Ember ring. Cells never overlap.
* **Buttons:** flat, 14px radius, min 48px tall. Primary = Ember fill with Linen text; secondary = Hairline outline. Press = 1px translate plus slight scale, no glow.
* **Cards/sheets:** used only for modals and the day sheet (24px top radius), shadow tinted to the background hue. Everywhere else, dividers and whitespace.
* **Inputs:** label above, helper/error below, Ember focus ring, no floating labels.
* **Loaders:** skeleton cells with a slow shimmer, same dimensions as the real grid. No spinners.
* **Empty states:** a composed empty calendar month with one line: "Nothing here yet. Add the first photo of this day." plus a single action.
* **Storage offline banner:** inline, Stone text with a small dot; cached thumbnails stay visible.

## 5. Layout Principles
- Mobile: single column, month grid edge-to-edge with 16px gutters; bottom tab bar (Calendar, Add, Albums, Settings), thumb-reachable.
- Day view is a bottom sheet over the calendar; photos in an asymmetric masonry, not equal thirds.
- Web: month grid left (max 720px), day detail right, whole layout capped at 1200px and centered by container, not by hero.
- CSS Grid, `100dvh`, never `h-screen`. Touch targets 44px minimum. No horizontal scroll.

## 6. Motion & Interaction
- Spring physics (stiffness 100, damping 20) for sheets and month changes; months slide horizontally.
- Photo cells fade in with a short stagger. Only `transform` and `opacity` animate.
- Subtle perpetual motion only on "uploading" (soft pulse on the cell). Respect reduced-motion: all motion becomes a plain fade.

## 7. Content & Language
All strings live in i18n files (es, en first). Tone: warm, short, human. Dates formatted by locale. Placeholder names are realistic, never "John Doe".

## 8. Anti-Patterns (Banned)
No emojis in UI. No Inter. No pure black or white-on-black. No neon glows or gradient text. No 3 equal-card rows. No overlapping content. No custom cursors. No "Scroll to explore" filler. No AI copy clichés ("Seamless", "Unleash", "Elevate"). No fake round stats (99%).
