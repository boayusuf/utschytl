# Chao Security Garden

A 3D cybersecurity visualization tool that lets operators monitor network devices across a multi-floor building, detect attacks in real-time, and quarantine compromised devices.

Built with a retro SEGA aesthetic using pixel fonts, vibrant colours, and game-themed floor interiors.

## What It Does

- **3D Building View** — Navigate a 5-floor building with orbit controls. Zoom into any floor to inspect individual devices.
- **Device Monitoring** — Each device displays a real-time trust score (0-100%), status (active/compromised/quarantined), and type (server, router, workstation, etc).
- **Attack Simulation** — Run a demo attack that randomly targets a device, showing the attack beam, trust score drop, data exfiltration, and alert generation.
- **Quarantine & Scan** — Click any device to inspect it, then quarantine or scan it directly from the HUD.
- **Threat Feed** — Live alert panel showing security events with severity levels (info, warning, critical).

## Floor Themes

Each floor is themed after a classic SEGA game:

| Floor | Theme | Visual Style |
|-------|-------|-------------|
| 1 | Green Hill Zone (Sonic) | Grass, checkered ground, loop ramps |
| 2 | Kamuro-cho (Yakuza) | Dark streets, neon signs, vending machines |
| 3 | Metaverse (Persona) | Red veins, spinning mask, tarot cards |
| 4 | Dojo (Shenmue) | Zen sand, cherry blossoms, stone lanterns |
| 5 | Chao Resort Island | Tropical palms, water pools, pastel colours |

## Tech Stack

- **React 19** — UI framework
- **Three.js** (via React Three Fiber + Drei) — 3D rendering
- **Zustand** — State management
- **Tailwind CSS v4** — Styling
- **Vite 7** — Build tool
- **WebSocket** — Optional real-time data feed (app works without a backend)

## Security Features

- WebSocket payload validation and sanitization (XSS prevention)
- HTML entity encoding on all external string data
- Message size limits (4KB max) and type whitelisting
- Login screen with SHA-256 password hashing and rate limiting (5 attempts, 30s lockout)
- Session management with 1-hour auto-expiry
- Full security report included (see `SECURITY_REPORT.md`)

## How to Run

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/boayusuf/utschytl.git
cd utschytl
npm install
npm run dev
