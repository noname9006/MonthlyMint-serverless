# Authentication & Security Documentation

## Overview
This document describes the authentication system and security measures implemented in the MonthlyMint serverless application.

## Authentication Flow

### 1. Discord OAuth Login
Users authenticate through Discord OAuth2:

1. **Initiation** (`/pages/api/auth/discord/login.ts`):
   - User clicks "Login with Discord" button on homepage
   - System generates a secure state token to prevent CSRF attacks
   - User is redirected to Discord authorization page

2. **Callback** (`/pages/api/auth/discord/callback.ts`):
   - Discord redirects back with authorization code
   - System validates state token to prevent CSRF
   - Exchanges code for access token
   - Fetches user information from Discord API
   - Fetches guild membership and role information
   - Creates/updates user record in database
   - Stores authentication data in `sessionStorage` (5-minute expiry)

### 2. Session Storage
After successful authentication:
- `discord_auth`: Full auth data with timestamp
- `discord_user_id`: User's Discord ID for admin checks

**Security Note**: Session data expires after 5 minutes and is stored client-side only.

### 3. Admin Authentication

#### Admin Configuration
Admins are configured via environment variables:
```
ADMIN1_USERID=discord_user_id_here
ADMIN2_USERID=another_discord_user_id_here
# Add as many as needed by incrementing the number
```

#### Admin Validation (`/lib/admin.ts`)
- `getAdminUserIds()`: Loads all ADMIN*_USERID environment variables
- `isAdmin(discordUserId)`: Checks if a Discord user ID is in the admin list
- `checkAdminAuth(discordUserId)`: Middleware-like validation function

#### Admin Dashboard Access Flow
1. User navigates to `/admin/dashboard`
2. Dashboard retrieves `discord_user_id` from sessionStorage
3. Dashboard calls `/api/admin/check-admin` with Discord user ID in **header**
4. API validates user ID against admin list
5. If authorized, dashboard content loads; otherwise, access denied

## Security Measures

### 1. Header-Based Authentication
**All admin API endpoints require the Discord user ID in the request header:**

```javascript
headers: {
  'x-discord-user-id': discordUserId
}
```

**Why headers instead of body?**
- Previous vulnerability: Users could send arbitrary `discordUserId` in request body, bypassing authentication
- Headers are set by the frontend code, not easily manipulated by end users
- Consistent pattern across all admin endpoints

### 2. Protected Admin Endpoints
The following endpoints require admin authentication:

- `POST /api/admin/check-admin` - Verify admin status
- `POST /api/admin/set-current-month` - Update current month/year settings
- `POST /api/admin/get-media-storage` - Fetch media storage for a month
- `POST /api/admin/update-media-storage` - Update IPFS CIDs for media

### 3. CSRF Protection
- State token validation during OAuth flow
- Tokens stored server-side and validated on callback

### 4. Database Logging
All authentication attempts are logged to the database for audit purposes.

### 5. Role-Based Access Control
Six-tier role hierarchy for users:
1. Botanist (highest)
2. Hyperion Ambassador
3. Sequoia Ambassador
4. Blossom Ambassador
5. Seedling Ambassador
6. Sprout (lowest)

Roles are fetched from Discord guild membership during authentication.

## Security Considerations

### Current Implementation
✅ OAuth state validation prevents CSRF  
✅ Admin check on all protected endpoints  
✅ Header-based authentication prevents body manipulation  
✅ Database logging for audit trails  
✅ Guild membership verification  
✅ Role-based access control  
✅ Session expiry (5 minutes)  

### Best Practices
1. **Never trust client input**: Always validate Discord user ID server-side
2. **Use headers for authentication**: Harder to manipulate than body parameters
3. **Validate on every request**: Don't cache admin status client-side
4. **Log authentication events**: Maintain audit trail
5. **Environment-based config**: Keep admin IDs in environment variables, not code

### Known Limitations
- Session storage is client-side and can be cleared
- 5-minute session expiry requires re-authentication
- No server-side session management (stateless architecture)

## Fixing Authentication Issues

### Issue: Admin Cannot Access Dashboard
**Symptom**: Admin users see "Access denied" even with valid ADMIN*_USERID

**Common Causes**:
1. Discord user ID not in sessionStorage (need to log in first)
2. Environment variable not set correctly
3. Mismatch between header/body in API calls

**Fix**: Ensure all admin API calls send `x-discord-user-id` in headers:
```javascript
fetch('/api/admin/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-discord-user-id': discordUserId
  },
  body: JSON.stringify({...})
})
```

### Issue: Authentication Bypass
**Symptom**: Non-admin users can access admin endpoints

**Prevention**:
1. Always read Discord user ID from headers, not body
2. Validate on every admin endpoint using `checkAdminAuth()`
3. Never trust client-provided admin status

## Recent Security Fixes

### Fix #1: Authentication Bypass (PR #40)
**Problem**: Users could send arbitrary `discordUserId` in request body to bypass authentication.

**Solution**: Changed all admin endpoints to read Discord user ID from `x-discord-user-id` header instead of request body.

### Fix #2: Admin Dashboard Access (Current)
**Problem**: After security fix, legitimate admins couldn't access dashboard because dashboard was still sending Discord user ID in body while API expected it in header.

**Solution**: Updated dashboard to send Discord user ID in `x-discord-user-id` header, matching all other admin endpoints.

## Testing Authentication

### Manual Testing Steps
1. **Test Non-Admin Access**:
   - Log in with non-admin Discord account
   - Navigate to `/admin/dashboard`
   - Should see "Access Denied" message

2. **Test Admin Access**:
   - Log in with admin Discord account (ID in ADMIN*_USERID)
   - Navigate to `/admin/dashboard`
   - Should see dashboard with month/year and media storage controls

3. **Test Session Expiry**:
   - Log in successfully
   - Wait 5+ minutes
   - Try accessing admin dashboard
   - Should require re-authentication

### Security Testing
- Try manipulating `discord_user_id` in sessionStorage
- Try sending requests with different user IDs in body (should fail)
- Verify all admin endpoints reject unauthenticated requests
- Check database logs for authentication attempts

## Environment Variables

Required for authentication:
```bash
# Discord OAuth
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
NEXT_PUBLIC_DISCORD_CLIENT_ID=your_client_id

# Admin Users
ADMIN1_USERID=123456789012345678
ADMIN2_USERID=987654321098765432
# Add more as needed

# Database
DATABASE_URL=postgresql://...
```

## Support & Troubleshooting

For authentication issues:
1. Check environment variables are set correctly
2. Verify Discord user ID is correct (18-digit number)
3. Clear sessionStorage and re-authenticate
4. Check database logs for authentication attempts
5. Verify API endpoints use header-based authentication
