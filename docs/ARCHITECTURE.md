# Architecture

This document describes the system architecture for Karaoke Hydra.

## System Overview

```mermaid
flowchart LR
    subgraph Public
        User([User])
        QR[QR Code]
    end

    subgraph Caddy[Caddy Proxy]
        proxy[reverse_proxy]
    end

    subgraph Backend
        App[Karaoke App]
        Authentik[Authentik OIDC]
    end

    User --> Caddy
    QR -.-> User
    proxy --> App
    App <-->|OIDC| Authentik
```

## User Flows

### QR Code Join Flow

```mermaid
flowchart TD
    QR[Scan QR Code] --> API["/api/rooms/join/{id}/{token}"]
    API --> LoggedIn{Logged in?}

    LoggedIn -->|Yes| SetCookie[Set room cookie]
    SetCookie --> Library[Go to Library]

    LoggedIn -->|No| Landing["/join?itoken=xxx"]
    Landing --> Choice{User choice}

    Choice -->|Login with Account| Login["/api/auth/login"]
    Login --> Authentik[Authentik OIDC]
    Authentik --> Callback["/api/auth/callback"]
    Callback --> Landing

    Choice -->|Join as Guest| Guest["/api/guest/join"]
    Guest --> Landing
```

## Authentication

The app uses app-managed OIDC with Authentik:

| OIDC Claim | Purpose |
|------------|---------|
| `preferred_username` | User identity |
| `groups` | Role assignment (admin/standard/guest) |

Standard users authenticate through Authentik OIDC. Guest room assignment is handled by app-issued sessions created from validated room invitation tokens, not by proxy headers.

## Components

### Server Stack
- **Koa** — HTTP framework
- **Socket.io** — Real-time queue updates
- **SQLite** — Embedded database
- **sqlite/sqlite3** — SQLite driver

### Client Stack
- **React** — UI framework
- **Redux** — State management
- **Socket.io-client** — Real-time updates

### Infrastructure
- **Caddy** — Reverse proxy (simple passthrough)
- **Authentik** — Identity provider (OIDC)

## Data Flow

1. **Authentication**: User → App → OIDC redirect → Authentik → Callback → App issues JWT
2. **Room Access**: QR scan → Validate token → Set cookie → Route to room
3. **Queue Updates**: Client ↔ Socket.io ↔ Server → Broadcast to room

## Related Documentation

- [Authentik Setup](AUTHENTIK_SETUP.md) — SSO configuration
- [Security](SECURITY.md) — Security model and hardening
- [SSO Overlay Architecture](architecture/sso-overlay.md) — Detailed SSO integration
