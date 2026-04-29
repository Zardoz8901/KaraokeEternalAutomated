# Authentik Setup

This guide covers configuring Authentik as the identity provider for Karaoke Hydra.

## Prerequisites

- Authentik instance running and accessible
- Admin access to create applications and providers
- Caddy (or similar) reverse proxy

## 1. Create OAuth2/OIDC Provider

In Authentik Admin → Applications → Providers → Create:

| Setting | Value |
|---------|-------|
| **Name** | `karaoke-eternal` |
| **Authorization flow** | `default-provider-authorization-implicit-consent` |
| **Client type** | Confidential |
| **Client ID** | (auto-generated, copy this) |
| **Client Secret** | (auto-generated, copy this) |
| **Redirect URIs** | `https://karaoke.example.com/api/auth/callback` |
| **Signing Key** | Select your signing key |

### Scopes

Enable these scopes:
- `openid`
- `profile`
- `email`
- `groups` (requires scope mapping, see below)

### Groups Scope Mapping

Create a Property Mapping (Applications → Property Mappings → Create):

**Name:** `OIDC-groups`
**Scope name:** `groups`
**Expression:**
```python
return list(request.user.ak_groups.values_list("name", flat=True))
```

Add this mapping to your provider's **Scope Mapping** list.

## 2. Create Application

In Authentik Admin → Applications → Create:

| Setting | Value |
|---------|-------|
| **Name** | `Karaoke Hydra` |
| **Slug** | `karaoke-eternal` |
| **Provider** | Select `karaoke-eternal` (created above) |
| **Launch URL** | `https://karaoke.example.com/` |

## 3. Caddy Configuration

Unlike header-based auth, OIDC uses simple reverse proxy (no `forward_auth`):

```caddyfile
karaoke.example.com {
    reverse_proxy karaoke:3000
}
```

That's it. The app handles authentication directly with Authentik via OIDC.

## 4. Environment Variables

### Required for OIDC

| Variable | Description | Example |
|----------|-------------|---------|
| `KES_OIDC_ISSUER_URL` | Authentik OIDC issuer URL | `https://auth.example.com/application/o/karaoke-eternal/` |
| `KES_OIDC_CLIENT_ID` | OAuth2 Client ID | `abc123...` |
| `KES_OIDC_CLIENT_SECRET` | OAuth2 Client Secret | `secret...` |
| `KES_PUBLIC_URL` | Public URL (for logout redirect) | `https://karaoke.example.com` |

### Role Mapping

| Variable | Default | Description |
|----------|---------|-------------|
| `KES_ADMIN_GROUP` | `admin` | Authentik group for admin role |
| `KES_GUEST_GROUP` | `karaoke-guests` | Authentik group for guest role |

### Proxy Settings

| Variable | Description | Example |
|----------|-------------|---------|
| `KES_REQUIRE_PROXY` | Enable secure cookies | `true` |

### Guest Join

Guest sessions are app-managed. Authentik API access is not required for QR guest join. Guests are created through `/api/guest/join` after the app validates a room invitation token.

## 5. Guest Join Flow

```
Guest scans QR → /api/rooms/join/{roomId}/{itoken}
  → Redirects to /join?itoken=xxx&guest_name=GuestName
  → Landing page: "Login with Account" or "Join as Guest"
  → Guest clicks join → POST /api/guest/join
  → App creates a room-bound guest user
  → App sets httpOnly keToken for 24 hours
  → Guest lands in the room
```

The Authentik policy mentioned in older analysis notes is only relevant to the deprecated Authentik-managed guest enrollment path.

## Troubleshooting

See [troubleshooting-auth-flow.md](operations/troubleshooting-auth-flow.md) for common issues.

## Related Documentation

- [Architecture](ARCHITECTURE.md) — System overview
- [Security](SECURITY.md) — Security model
- [Guest Enrollment Details](operations/authentik-guest-enrollment.md)
