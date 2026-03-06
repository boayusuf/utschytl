# Chao Security Garden

A 3D cybersecurity visualization tool that lets operators monitor network devices across a multi-floor building, detect attacks in real-time, and quarantine compromised devices.

Built with a retro SEGA aesthetic using pixel fonts, vibrant colours, and game-themed floor interiors.

## What It Does

- **3D Building View**
- **Device Monitoring**
- **Attack Simulation**
- **Quarantine & Scan**
- **Threat Feed**

Each floor is themed after a classic SEGA game:


## Tech Stack

- **React 19**
- **Three.js**
- **Zustand**
- **Tailwind CSS v4**
- **Vite 7**
- **WebSocket**

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
