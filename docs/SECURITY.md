# Security

This document describes the security model and hardening measures for Karaoke Hydra.

## Threat Model

The system handles:
- **User authentication** via external identity provider (Authentik)
- **Multi-tenant room access** with guest enrollment
- **Session management** via cookies

Primary threats:
- Direct backend access bypassing authentication
- Session hijacking
- Guest account persistence beyond intended lifetime

## Security Controls

| Risk | Mitigation |
|------|------------|
| Direct port access | Never expose app port; enforce trusted reverse proxy sources in production |
| Cookie theft | `httpOnly`, `Secure`, `SameSite=Lax` flags |
| OIDC state tampering | PKCE (code verifier) + state parameter validation |
| Guest persistence | 24-hour app-issued guest session plus room-bound guest role |
| SSO logout loop | Redirect to IdP signout before clearing client state |

## Configuration Hardening

### Required Settings

```bash
# OIDC Configuration
KES_OIDC_ISSUER_URL=https://auth.example.com/application/o/karaoke-eternal/
KES_OIDC_CLIENT_ID=<client-id>
KES_OIDC_CLIENT_SECRET=<client-secret>

# Group names for role mapping
KES_ADMIN_GROUP=karaoke-admin
KES_GUEST_GROUP=karaoke-guests
```

### HTTPS Requirement

Secure cookies require HTTPS. The reverse proxy should:
- Terminate TLS
- Set `X-Forwarded-Proto: https`

### Public Endpoints

Authentication is enforced by the app. Only these API paths are public before a `keToken` session exists:

| Endpoint | Purpose | Risk Level |
|----------|---------|------------|
| `/api/auth/login` | Start OIDC login | Low — redirects to configured IdP |
| `/api/auth/callback` | OIDC callback | Medium — protected by state + PKCE |
| `/api/guest/join` | App-managed guest session creation | Medium — validates room token and rate limits |
| `/api/rooms/join/*` | QR join/validation | Low — validates UUID tokens |
| `/api/prefs/public` | Public login/config hints | Low — no secrets |

The SPA `/join` route is public UI. Protected API routes return `401` when no valid signed session cookie is present.

## Session Management

- **Session cookie**: `keToken` (httpOnly, Secure, SameSite=Lax)
- **Room visitation cookie**: `keVisitedRoom` (httpOnly; validated server-side before room context changes)
- **Logout flow**: Client → IdP signout → Clear local state

See [security_audit_oidc_signout_2026_01_26.md](analysis/security_audit_oidc_signout_2026_01_26.md) for logout security details.

## Guest Account Lifecycle

1. Guest scans QR code.
2. Server validates the room invitation token.
3. `/api/guest/join` creates a guest user bound to that room and issues a 24-hour `keToken`.
4. Guests cannot switch rooms and cannot mutate presets or folders.
5. Guest session ends when the cookie expires, the user logs out, or access is revoked.

## Audit Logs

Security-relevant events are logged:
- Authentication attempts (success/failure)
- Role changes (admin promotion/demotion)
- Room creation/deletion

Logs do not contain tokens or credentials.

## Related Documentation

- [Architecture](ARCHITECTURE.md) — System overview
- [Authentik Setup](AUTHENTIK_SETUP.md) — SSO configuration
- [Security Audit (2026-01-23)](analysis/security_audit_2026_01_23.md)
- [OIDC Signout Audit (2026-01-26)](analysis/security_audit_oidc_signout_2026_01_26.md)
