# SEGA HQ - Security Report
## Secure Network Monitoring Dashboard

**Team:** [Your Team Name]
**Date:** March 2026
**Version:** 1.0

---

## 1. System Overview

SEGA HQ is a 3D cybersecurity visualization dashboard that provides real-time monitoring of network devices across a multi-floor building. It displays device trust scores, detects attacks, and enables operators to quarantine compromised devices.

**Architecture:** React 19 + Three.js frontend, optional WebSocket backend for live data feeds.

---

## 2. Assets

| Asset | Description | Sensitivity |
|-------|-------------|-------------|
| Device Trust Scores | Real-time trust/health metrics per device | High |
| Alert/Threat Data | Security event logs and incident records | High |
| User Credentials | Login credentials for dashboard access | Critical |
| Session Tokens | Session state stored in sessionStorage | High |
| Network Topology | Floor layouts, device positions, connections | Medium |
| Quarantine Controls | Ability to isolate devices from the network | Critical |

---

## 3. Threat Model (STRIDE)

### Threat 1: WebSocket Message Injection
- **Category:** Tampering
- **Description:** An attacker could inject malicious payloads via WebSocket messages to create fake alerts, manipulate trust scores, or inject XSS payloads into the dashboard.
- **Likelihood:** High (WebSocket accepts external data)
- **Impact:** High (could mislead operators into wrong actions)
- **Mitigation:** All WebSocket payloads are validated and sanitized. String fields are HTML-escaped, values are range-checked, unknown message types are dropped, and messages over 4KB are rejected.

### Threat 2: Brute Force Authentication
- **Category:** Spoofing
- **Description:** An attacker could attempt to guess credentials through repeated login attempts.
- **Likelihood:** Medium
- **Impact:** Critical (unauthorized dashboard access)
- **Mitigation:** Login is rate-limited to 5 attempts with a 30-second lockout. Passwords are hashed with SHA-256 before comparison. Input is sanitized (alphanumeric only, max length enforced).

### Threat 3: Cross-Site Scripting (XSS)
- **Category:** Tampering
- **Description:** Malicious scripts could be injected through alert messages, device names, or WebSocket data and executed in the operator's browser.
- **Likelihood:** Medium (data comes from WebSocket)
- **Impact:** High (session hijack, data theft)
- **Mitigation:** Content Security Policy (CSP) headers restrict script sources to 'self'. All external string data is sanitized with HTML entity encoding. React's JSX escaping provides an additional layer of protection.

### Threat 4: Session Hijacking
- **Category:** Elevation of Privilege
- **Description:** An attacker could steal or forge session tokens to gain unauthorized access.
- **Likelihood:** Low (sessionStorage is tab-scoped)
- **Impact:** High (full dashboard access)
- **Mitigation:** Sessions are stored in sessionStorage (not localStorage), limiting exposure to the current tab. Sessions auto-expire after 1 hour. No sensitive data is stored in the token.

### Threat 5: Clickjacking
- **Category:** Tampering
- **Description:** The dashboard could be embedded in a malicious iframe, tricking operators into clicking quarantine/isolate buttons.
- **Likelihood:** Low
- **Impact:** Medium (unintended device quarantine)
- **Mitigation:** X-Frame-Options: DENY header prevents iframe embedding. Permissions-Policy restricts camera/microphone/geolocation access.

---

## 4. Security Controls Implemented

| Control | Implementation | Justification |
|---------|---------------|---------------|
| Authentication | SHA-256 hashed password comparison with login screen | Prevents unauthorized access to monitoring dashboard |
| Rate Limiting | 5 login attempts, 30s lockout | Mitigates brute force attacks |
| Input Sanitization | HTML entity encoding on all WebSocket payloads | Prevents XSS via injected data |
| Payload Validation | Type checking, value range enforcement, max length | Prevents data manipulation and buffer attacks |
| CSP Headers | Restrictive Content-Security-Policy | Blocks unauthorized script execution |
| Security Headers | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy | Defence in depth against common web attacks |
| Session Management | sessionStorage with 1-hour expiry | Limits session exposure window |
| WebSocket Origin Check | URL validation before connection | Prevents connecting to malicious WebSocket servers |
| Message Size Limit | 4KB max per WebSocket message | Prevents DoS via oversized payloads |

---

## 5. Attack Surfaces

| Surface | Risk Level | Controls |
|---------|-----------|----------|
| Login form | Medium | Rate limiting, input sanitization, hashed credentials |
| WebSocket connection | High | Payload validation, sanitization, size limits, origin checks |
| Dashboard UI (quarantine/scan buttons) | Medium | Authentication required, X-Frame-Options |
| sessionStorage | Low | Tab-scoped, auto-expiry, no sensitive data |
| Static assets (JS/CSS) | Low | CSP headers, served from same origin |

---

## 6. Residual Risks

| Risk | Severity | Reason |
|------|----------|--------|
| Client-side credential storage | Medium | Hashes are in frontend code; production would use server-side auth with bcrypt/argon2 |
| No HTTPS enforcement in dev | Medium | Development uses HTTP; production deployment should enforce HTTPS/WSS |
| No role-based access control | Low | All authenticated users have same permissions; production would implement RBAC |
| No audit logging | Low | Actions (quarantine, scan) are not persisted; production would log to server |
| WebSocket not authenticated | Medium | WS connection doesn't verify session; production would require token-based WS auth |

---

## 7. Secure-by-Design Principles Applied

1. **Defence in Depth:** Multiple layers of security (auth + CSP + sanitization + validation)
2. **Least Privilege:** CSP restricts permissions; Permissions-Policy blocks unnecessary APIs
3. **Fail Secure:** Invalid WebSocket messages are silently dropped; malformed login attempts are rejected
4. **Input Validation:** All external data is validated at the boundary before processing
5. **Secure Defaults:** Session expires automatically; login is required by default

---

## 8. Legal and Ethical Considerations

- The system processes network monitoring data which may contain sensitive operational information
- GDPR considerations: Device data could be linked to individuals; data minimization is applied (only trust scores and status displayed)
- The attack simulation is for demonstration purposes only and does not interact with real systems
- All credential handling follows OWASP guidelines for client-side applications

---

## 9. Future Improvements

- Migrate to server-side authentication with bcrypt/argon2 password hashing
- Implement JWT-based WebSocket authentication
- Add role-based access control (Admin, Analyst, Viewer)
- Enable HTTPS/WSS enforcement with HSTS headers
- Add comprehensive audit logging for all operator actions
- Implement Content Security Policy reporting endpoint
