# Architecture: App-Managed OIDC And Smart QR

This document visualizes the current authentication shape. The app, not the reverse proxy, owns authentication and room-join decisions.

## Standard Account Flow
The reverse proxy terminates TLS and forwards requests to the app. The app starts and completes OIDC with Authentik, then issues its own httpOnly `keToken` session cookie.

```mermaid
graph TD
    User((User)) -->|HTTPS| Proxy[Caddy / reverse proxy]
    Proxy --> App[Karaoke App]
    App -->|/api/auth/login| Authentik[Authentik OIDC]
    Authentik -->|code + state| Callback["/api/auth/callback"]
    Callback --> App
    App -->|httpOnly keToken| User
```

## Smart QR Flow
The QR endpoint is public, but the app validates UUID invitation tokens before setting room context or creating a guest session.

```mermaid
graph TD
    User((User / Guest)) -->|Scan QR| URL["/api/rooms/join/..."]
    URL --> App[Karaoke App]

    subgraph "Application Logic"
        App --> Validate[Validate room + invitation token]
        Validate --> Session{Logged in?}
        Session -- "Yes" --> Visit[Set keVisitedRoom cookie]
        Session -- "No, login" --> Login["/api/auth/login"]
        Session -- "No, guest" --> Guest["POST /api/guest/join"]
        Guest --> Token[Create room-bound guest + keToken]
    end
```

## Why The App Owns This
1. **Security boundary:** Protected APIs return `401` unless the signed `keToken` is valid.
2. **Room context:** `keVisitedRoom` is only accepted after server-side room validation.
3. **Guest isolation:** Guests are bound to their enrollment room and cannot mutate presets or folders.
4. **Proxy simplicity:** Caddy no longer needs `forward_auth` bypass rules for app routes, sockets, or guest QR flows.
