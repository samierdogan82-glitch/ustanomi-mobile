---
name: offline-pwa-workbox-capacitor
description: >-
  Offline-first Progressive Web App & Capacitor hybrid mobile skill: IndexedDB mutation queues, Workbox NetworkOnly auth guards, and iOS safe-area ergonomics. (Source: GoogleChrome/workbox, License: MIT, Stars: 13200)
---

# offline-pwa-workbox-capacitor — Agent Skill Playbook (GoogleChrome/workbox)

- **Upstream Repository:** `https://github.com/GoogleChrome/workbox`
- **Category:** `mobile-pwa-offline` | **License:** `MIT`
- **Keywords:** `pwa`, `workbox`, `capacitor`, `indexeddb`, `dexie`, `offline`, `service-worker`, `ios-safe-area`

## Mandatory Execution Rules
1. Never cache /api/auth or session responses in Service Workers (enforce NetworkOnly).
2. Buffer offline field mutations in IndexedDB and replay idempotently on reconnect.
