---
name: zamboalert-designing
description: Design or restyle ZamboAlert UI - mobile screens (citizen/rescuer) and the web dashboard (tactical map, panels). Use for layout, theming, UX, and visual consistency work.
---

# Designing for ZamboAlert

## Context drives design
Users are in emergencies: citizens panicking, rescuers in the field in sun, rain, or dark, officials monitoring a live map. Prioritize clarity, speed, and resilience over decoration.

## Principles
- **One primary action per screen.** The SOS action must be unmistakable, large, and reachable one-handed. Show clear sending / sent / failed-retry states and the offline/BLE fallback state.
- **Large touch targets** (48dp or more) and high contrast (WCAG AA minimum), readable outdoors. Never rely on color alone for severity or status; pair it with an icon or text.
- **Status first**: connection (LoRa/BLE/cellular), GPS lock, last-update time, and verification state visible without digging.
- **Plain language** and short labels; consider Filipino/English clarity for citizens.
- **Dashboard**: dense but scannable; the map dominates, pods/SOS list beside it sorted by severity, stale pods visibly dimmed (90s TTL), clear empty and error states.

## Implementation
- Mobile: use tokens in `zamboalert-app/src/theme/colors.ts` and `typography.ts`, and reuse `components/`. Don't hardcode hex values or font sizes in screens; add new tokens to the theme. Handle safe areas, keyboard, and small screens.
- Web: Tailwind v4 utilities in `zamboalert-web/src`, shared styles in `styles.css`; stay responsive down to tablet width.
- Match the existing visual language (logo `zamboalert.png`, current palette) before proposing a new one. For a redesign, change tokens centrally.

## Check
Run the screen in the real client (device/emulator or Vite) and review loading, empty, error, and long-text states before calling it done.
