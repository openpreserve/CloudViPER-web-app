# ForwardAuth Implementation Plan: Instance Access Control

## Overview
Implement Traefik ForwardAuth middleware to replace KasmVNC basic authentication with seamless CloudViPER session-based authentication. This allows users to access their instances without additional login prompts, while maintaining security through ownership verification.

---

## Phase 1: Investigation & Prerequisites

### 1.1 Session Cookie Configuration
**File:** `web-app/src/app.ts`

**Tasks:**
- [ ] Check current `cookie.domain` setting in session configuration
- [ ] Verify `cookie.secure` is set to `true` (required for HTTPS)
- [ ] Verify `cookie.httpOnly` is set to `true` (security)
- [ ] Check `cookie.sameSite` setting
- [ ] **Required Change:** Must set `domain: '.ddhn.cloudviper.org'` to allow cookies across all subdomains
- [ ] **Warning:** Changing cookie domain will log out existing users temporarily

### 1.2 Database Schema Review
**File:** `web-app/src/models/ViperInstanceModel.ts` (or similar)

**Tasks:**
- [ ] Verify how instance ownership is stored (user_id field?)
- [ ] Document query method to find instance by UUID
- [ ] Verify admin role detection method (User model)
- [ ] Document exact query needed in ForwardAuth endpoint

### 1.3 Current KasmVNC Authentication
**File:** `web-app/src/services/ViperInstanceService.ts` (lines ~53-59)

**Tasks:**
- [ ] Review current basic auth configuration (PASSWORD env var)
- [ ] Research KasmVNC documentation for disabling auth
- [ ] Identify correct environment variable (likely `KASM_AUTH`, `AUTH_TYPE`, or `DISABLE_AUTH`)
- [ ] Document fallback approach if needed

---

## Phase 2: Core Implementation

### 2.1 Create ForwardAuth Endpoint
**File:** `web-app/src/routes/authRoutes.ts` (or create new file)

**Endpoint:** `GET /auth/verify-instance-access`

**Implementation Logic:**
```typescript
1. Extract instance UUID from X-Forwarded-Host header
   - Parse: {uuid}.ddhn.cloudviper.org → extract {uuid}
   - Handle edge cases (malformed hostnames)

2. Check if user is authenticated
   - Verify req.session.userId exists
   - If not: return 401 with optional redirect to login

3. Query database for instance by UUID
   - If not found: return 404

4. Check ownership:
   - If instance.user_id === req.session.userId: allow (200)
   - Else if user.role === 'admin': allow (200)
   - Else: return 403 (forbidden)

5. Optional: Log access attempt for auditing
   - Log: timestamp, UUID, user_id, result
```

**Response Specifications:**
- **200 OK:** User authorized to access instance
  - Headers: `X-User-Id: {userId}` (optional, for debugging)
- **401 Unauthorized:** No valid session
  - Header: `Location: https://ddhn.cloudviper.org/account/login?redirect={instance-url}`
- **403 Forbidden:** Valid session but not owner/admin
  - Body: `{ "error": "Access denied", "message": "You don't have permission to access this instance" }`
- **404 Not Found:** Instance doesn't exist
  - Body: `{ "error": "Instance not found" }`

**Error Handling:**
- Database connection errors → 503
- Malformed headers → 400
- Internal errors → 500

### 2.2 Register Route in Main App
**File:** `web-app/src/app.ts`

**Tasks:**
- [ ] Import auth route module
- [ ] Mount route: `app.use('/auth', authRoutes)`
- [ ] Ensure route is registered before other middleware that might interfere
- [ ] Verify route ordering doesn't break existing auth flows

### 2.3 Update Session Cookie Domain
**File:** `web-app/src/app.ts`

**Tasks:**
- [ ] Locate session configuration block
- [ ] Update cookie settings:
  ```typescript
  cookie: {
    domain: '.ddhn.cloudviper.org',  // Leading dot is critical
    secure: true,                      // HTTPS only
    httpOnly: true,                    // XSS protection
    sameSite: 'lax',                   // CSRF protection
    maxAge: 1000 * 60 * 60 * 24 * 7   // 7 days (adjust as needed)
  }
  ```
- [ ] Test cookie propagation across subdomains
- [ ] Verify existing functionality still works

---

## Phase 3: Traefik Integration

### 3.1 Traefik Middleware Strategy
**Decision:** Use dynamic labels (per-instance) rather than static global config

**Rationale:**
- Flexibility for future per-instance customization
- Easier debugging (labels visible in container inspect)
- No Traefik config file changes needed

### 3.2 Update ViperInstanceService Container Creation
**File:** `web-app/src/services/ViperInstanceService.ts`
**Location:** Lines ~74-100 (labels object in containerOptions)

**Add Labels:**
```javascript
labels: {
  // Existing labels...
  'traefik.enable': 'true',
  [`traefik.http.routers.${instanceUUID}.rule`]: `Host(\`${instanceUUID}.${process.env.APP_HOST}\`)`,
  [`traefik.http.routers.${instanceUUID}.entrypoints`]: 'websecure',
  [`traefik.http.routers.${instanceUUID}.tls.certresolver`]: 'letsencrypt',
  
  // NEW: ForwardAuth middleware assignment
  [`traefik.http.routers.${instanceUUID}.middlewares`]: `instance-auth-${instanceUUID}@docker`,
  
  // NEW: ForwardAuth middleware definition
  [`traefik.http.middlewares.instance-auth-${instanceUUID}.forwardauth.address`]: `https://ddhn.cloudviper.org/auth/verify-instance-access`,
  [`traefik.http.middlewares.instance-auth-${instanceUUID}.forwardauth.trustForwardHeader`]: 'true',
  [`traefik.http.middlewares.instance-auth-${instanceUUID}.forwardauth.authResponseHeaders`]: 'X-User-Id',
  [`traefik.http.middlewares.instance-auth-${instanceUUID}.forwardauth.authRequestHeaders`]: 'Cookie,X-Forwarded-Host',
  
  // Existing service labels...
  [`traefik.http.services.${instanceUUID}.loadbalancer.server.port`]: '3000',
  'traefik.docker.network': 'cloudviper_ingress'
}
```

**Tasks:**
- [ ] Add ForwardAuth labels to container creation
- [ ] Ensure unique middleware names per instance (prevent conflicts)
- [ ] Verify label syntax (Traefik v3 compatibility)
- [ ] Test with single instance first

### 3.3 Disable KasmVNC Basic Auth
**File:** `web-app/src/services/ViperInstanceService.ts`
**Location:** Lines ~53-59 (envVars)

**Research Required:**
- [ ] Check KasmVNC documentation for auth disable method
- [ ] Test potential environment variables:
  - `KASM_AUTH=false`
  - `AUTH_TYPE=none`
  - `DISABLE_AUTH=true`
  - Remove `PASSWORD` entirely

**Implementation Options:**

**Option A: Complete Disable (Preferred)**
```javascript
const envVars = {
  PUID: '1000',
  PGID: '1000',
  KASM_AUTH: 'false'  // or appropriate variable
};
```

**Option B: Fallback Security Layer**
```javascript
const envVars = {
  PUID: '1000',
  PGID: '1000',
  PASSWORD: crypto.randomBytes(32).toString('hex')  // Random, never shared with user
};
```

**Decision:** Start with Option B for safety, migrate to Option A after testing

---

## Phase 4: Testing Strategy

### 4.1 Unit Testing - ForwardAuth Endpoint

**Test Setup:**
```bash
# Get session cookie from browser dev tools after login
SESSION_COOKIE="connect.sid=s%3A..."

# Test endpoint directly
curl -v \
  -H "X-Forwarded-Host: {test-uuid}.ddhn.cloudviper.org" \
  -b "$SESSION_COOKIE" \
  https://ddhn.cloudviper.org/auth/verify-instance-access
```

**Test Cases:**
- [ ] **No session cookie** → Expect 401
- [ ] **Valid owner session** → Expect 200
- [ ] **Different user session** → Expect 403
- [ ] **Admin user session** → Expect 200
- [ ] **Non-existent instance UUID** → Expect 404
- [ ] **Malformed hostname** → Expect 400
- [ ] **Expired session** → Expect 401

### 4.2 Integration Testing - Traefik Labels

**After rebuilding app container:**

**Verify Labels Applied:**
```bash
# Create test instance
# Check container labels
docker inspect viper-{uuid} | jq '.Config.Labels' | grep forwardauth
```

**Expected Output:**
```json
{
  "traefik.http.middlewares.instance-auth-{uuid}.forwardauth.address": "https://ddhn.cloudviper.org/auth/verify-instance-access",
  "traefik.http.routers.{uuid}.middlewares": "instance-auth-{uuid}@docker"
}
```

**Check Traefik Router Configuration:**
```bash
# Access Traefik API (if enabled)
curl http://localhost:8080/api/http/routers | jq '.[] | select(.name | contains("{uuid}"))'
```

**Verify Middleware Chain:**
```bash
curl http://localhost:8080/api/http/middlewares | jq '.[] | select(.name | contains("instance-auth"))'
```

### 4.3 End-to-End Testing

#### Test Scenario 1: Owner Access
1. [ ] Login to CloudViPER as User A
2. [ ] Create new instance
3. [ ] Note instance URL: `https://{uuid}.ddhn.cloudviper.org`
4. [ ] Click instance URL in new tab
5. [ ] **Expected:** KasmVNC desktop loads immediately without password prompt
6. [ ] **Verify:** No basic auth dialog appears

#### Test Scenario 2: Unauthorized Access
1. [ ] Login to CloudViPER as User B (different user)
2. [ ] Navigate to User A's instance URL (from Scenario 1)
3. [ ] **Expected:** 403 Forbidden or redirect to error page
4. [ ] **Verify:** Cannot access instance

#### Test Scenario 3: Admin Access
1. [ ] Login to CloudViPER as Admin user
2. [ ] Navigate to any user's instance URL
3. [ ] **Expected:** KasmVNC desktop loads immediately
4. [ ] **Verify:** Admin has universal access

#### Test Scenario 4: Unauthenticated Access
1. [ ] Open incognito/private browser window
2. [ ] Navigate directly to instance URL (no CloudViPER login)
3. [ ] **Expected:** Redirect to CloudViPER login page
4. [ ] After login → redirect back to instance URL
5. [ ] If user is owner → KasmVNC loads

#### Test Scenario 5: Session Expiration
1. [ ] Login and access instance (working)
2. [ ] Clear session cookie or wait for expiration
3. [ ] Refresh instance page
4. [ ] **Expected:** Redirect to login
5. [ ] After re-login → can access again

### 4.4 Edge Cases & Security Testing

**Cookie Domain Verification:**
- [ ] Login to `https://ddhn.cloudviper.org`
- [ ] Check browser dev tools → Cookie domain should be `.ddhn.cloudviper.org`
- [ ] Visit `https://{uuid}.ddhn.cloudviper.org`
- [ ] Verify same session cookie is sent

**Cross-Subdomain Session:**
- [ ] Login to main app
- [ ] Create Instance A → access works
- [ ] Create Instance B → access works
- [ ] Both should use same session cookie

**Security Validations:**
- [ ] Attempt to forge X-Forwarded-Host header (should be ignored due to trustForwardHeader)
- [ ] Test SQL injection in UUID parameter
- [ ] Test with extremely long UUID strings
- [ ] Verify admin check can't be bypassed

**Performance Testing:**
- [ ] Measure ForwardAuth latency (should be < 50ms)
- [ ] Test with 10+ concurrent instance access requests
- [ ] Check database connection pooling under load

---

## Phase 5: Rollout & Safety

### 5.1 Feature Flag Approach

**Environment Variable:** Add to `.env`
```bash
ENABLE_FORWARDAUTH=false  # Start disabled
```

**Implementation Pattern:**
```typescript
// In ViperInstanceService.ts
const labels = {
  // ... base labels ...
};

if (process.env.ENABLE_FORWARDAUTH === 'true') {
  // Add ForwardAuth labels
  Object.assign(labels, {
    [`traefik.http.routers.${instanceUUID}.middlewares`]: `instance-auth-${instanceUUID}@docker`,
    // ... other ForwardAuth labels ...
  });
  
  // Disable KasmVNC basic auth
  envVars.KASM_AUTH = 'false';
} else {
  // Use existing basic auth (current behavior)
  envVars.PASSWORD = generateRandomPassword();
}
```

**Rollout Steps:**
1. [ ] Deploy with `ENABLE_FORWARDAUTH=false` (no change to existing behavior)
2. [ ] Test ForwardAuth endpoint manually
3. [ ] Set `ENABLE_FORWARDAUTH=true` in development/staging
4. [ ] Test thoroughly (all scenarios from Phase 4)
5. [ ] Deploy to production with flag still `false`
6. [ ] Enable for new instances only (existing keep basic auth)
7. [ ] Monitor for 24-48 hours
8. [ ] If stable, enable for all new instances
9. [ ] Eventually remove flag and old code path

### 5.2 Migration Strategy

**For Existing Instances:**
- [ ] **Option A:** Leave existing instances with basic auth (no changes)
- [ ] **Option B:** Add "Upgrade Auth" button in UI to recreate instance with ForwardAuth
- [ ] **Decision:** Use Option A initially, add Option B as enhancement

**For New Instances:**
- [ ] All new instances created after flag enabled use ForwardAuth
- [ ] Store auth method in database: `instance.auth_type = 'forwardauth' | 'basic'`
- [ ] UI shows different instructions based on auth_type

### 5.3 Monitoring & Observability

**Logging Requirements:**

**ForwardAuth Endpoint Logs:**
```typescript
logger.info('ForwardAuth request', {
  uuid: instanceUUID,
  userId: req.session.userId,
  result: 'allowed' | 'denied',
  reason: 'owner' | 'admin' | 'unauthorized' | 'not_found',
  timestamp: new Date().toISOString()
});
```

**Metrics to Track:**
- [ ] ForwardAuth requests per minute
- [ ] Success rate (200 responses)
- [ ] Unauthorized attempts (401/403 responses)
- [ ] Average response time
- [ ] Failed database queries

**Alerts to Configure:**
- [ ] High 403 rate (> 10% of requests) → might indicate bug
- [ ] High 404 rate → stale URLs or instance deletion issues
- [ ] ForwardAuth response time > 100ms → database performance issue
- [ ] Repeated 403s from same IP → potential security issue

**Dashboard Metrics:**
```
- Total ForwardAuth requests (24h)
- Success rate percentage
- Average latency (p50, p95, p99)
- Top accessed instances
- Admin access frequency
```

---

## Phase 6: Documentation & Future Enhancements

### 6.1 User Documentation

**Update Files:**
- [ ] `README.md` - Add section on seamless instance access
- [ ] `docs/USER_GUIDE.md` - Remove basic auth password instructions
- [ ] `docs/ADMIN_GUIDE.md` - Document admin access capabilities

**Key Points to Document:**
- Users no longer need to remember instance passwords
- Access is automatic when logged into CloudViPER
- Session cookies must be enabled in browser
- Logout from CloudViPER also revokes instance access

### 6.2 Admin Features (Future Enhancements)

**Admin Panel Improvements:**
- [ ] **Instance Access Dashboard**
  - List all instances with "Access" button for admin
  - Show instance owner, status, last accessed time
  - Quick access to any instance for support purposes

- [ ] **Access Logs Viewer**
  - Table showing: timestamp, instance UUID, user, action, result
  - Filter by user, instance, date range
  - Export to CSV for compliance/auditing

- [ ] **Access Management**
  - "Revoke Access" button (force logout or stop instance)
  - Temporary access grants for support staff
  - Access expiration settings

### 6.3 Future Enhancement Ideas

**1. Instance Sharing (Multi-user Access)**
```typescript
// Database schema addition
interface ViperInstance {
  user_id: string;           // Owner
  shared_with: string[];     // Array of user IDs with access
  share_expires_at?: Date;   // Optional expiration
}

// UI: "Share Instance" button
// - Enter email address
// - Grant read-only or full access
// - Set expiration time
// - Send notification email
```

**2. Time-Limited Access Tokens**
```typescript
// Generate temporary URL with JWT token
// https://{uuid}.ddhn.cloudviper.org?access_token=eyJh...
// 
// Use case: Share with external user without CloudViPER account
// Token expires after configurable time (1 hour, 1 day, etc.)
```

**3. SSO Integration (Authentik)**
```typescript
// Phase 3 from original plan
// Use Authentik for CloudViPER login (SSO)
// Keep ForwardAuth for instance authorization
// Benefits: Enterprise SSO, MFA, OAuth providers
```

**4. Access Analytics**
```typescript
// Track detailed usage metrics:
// - Most accessed instances
// - Average session duration
// - Access patterns by time of day
// - User access frequency
```

**5. Collaborative Instances**
```typescript
// Multiple users can access same instance simultaneously
// Show "Active Users" indicator
// Chat or notification system for collaboration
// Use case: Pair programming, teaching, demos
```

**6. API Access with Tokens**
```typescript
// Generate API tokens for programmatic instance access
// Use case: CI/CD pipelines, automated testing
// 
// POST /api/instances/{uuid}/access-token
// Response: { token: "...", expires_at: "..." }
```

---

## Critical Decision Points

### A. Session Cookie Domain
**Current State:** Unknown (needs investigation)
**Required:** `.ddhn.cloudviper.org` (with leading dot)
**Impact:** Will log out all existing users when changed
**Mitigation:** 
- Announce maintenance window
- Display notice: "Please log in again after update"
- Consider implementing persistent "remember me" tokens

### B. KasmVNC Auth Disable Method
**Research Needed:** Exact environment variable name
**Options:**
1. `KASM_AUTH=false`
2. `AUTH_TYPE=none`
3. `DISABLE_AUTH=true`
4. Remove `PASSWORD` entirely

**Testing Approach:**
1. Start with fallback (random PASSWORD + ForwardAuth)
2. Test each disable option in development
3. Verify VNC still functions correctly
4. Document working method

**Fallback Plan:** If auth can't be disabled, keep random password but don't show to users

### C. Traefik Label Naming Strategy
**Option 1: Unique per instance** (Recommended)
```
traefik.http.middlewares.instance-auth-{uuid}.forwardauth...
```
**Pros:** 
- Future per-instance customization
- Easier debugging (grep logs by UUID)
- No conflicts between instances

**Option 2: Shared middleware**
```
traefik.http.middlewares.instance-auth.forwardauth...
```
**Pros:** 
- Simpler label definition
- Less label overhead

**Decision:** Use Option 1 for flexibility

### D. Error Handling & User Experience
**On 401 (Unauthorized):**
- **Option A:** Redirect to CloudViPER login with return URL
- **Option B:** Show custom "Please log in" page
- **Decision:** Option A (seamless UX)

**On 403 (Forbidden):**
- **Option A:** Show "Access Denied" error page
- **Option B:** Redirect to CloudViPER dashboard with message
- **Decision:** Option A with helpful message

**On 404 (Instance Not Found):**
- **Option A:** Show "Instance not found or stopped" page
- **Option B:** Redirect to instances list
- **Decision:** Option A with link to dashboard

---

## Implementation Order (Checklist)

### Pre-Implementation
- [ ] Create feature branch: `feature/forwardauth-implementation`
- [ ] Review this plan with team
- [ ] Set up test environment/subdomain

### Phase 1: Investigation (Week 1, Days 1-2)
- [ ] 1.1: Analyze current session cookie configuration
- [ ] 1.2: Document database schema for instances and users
- [ ] 1.3: Research KasmVNC auth disable options
- [ ] Document findings in implementation notes

### Phase 2: Core Development (Week 1, Days 3-5)
- [ ] 2.1: Create ForwardAuth endpoint with full logic
- [ ] 2.1: Add comprehensive error handling
- [ ] 2.1: Add logging to ForwardAuth endpoint
- [ ] 2.2: Register route in main app
- [ ] 2.3: Update session cookie domain
- [ ] Unit test ForwardAuth endpoint

### Phase 3: Traefik Integration (Week 2, Days 1-2)
- [ ] 3.1: Design label structure
- [ ] 3.2: Update ViperInstanceService with new labels
- [ ] 3.2: Add feature flag logic
- [ ] 3.3: Implement KasmVNC auth disable
- [ ] Code review

### Phase 4: Testing (Week 2, Days 3-5)
- [ ] 4.1: Unit test ForwardAuth endpoint
- [ ] 4.2: Integration test - verify labels
- [ ] 4.2: Integration test - verify Traefik routing
- [ ] 4.3: E2E test - all scenarios (owner, admin, unauthorized, etc.)
- [ ] 4.4: Security testing
- [ ] 4.4: Performance testing
- [ ] Document test results

### Phase 5: Deployment (Week 3)
- [ ] 5.1: Deploy to staging with feature flag OFF
- [ ] 5.1: Test ForwardAuth endpoint in staging
- [ ] 5.1: Enable feature flag in staging
- [ ] 5.1: Full regression testing
- [ ] 5.2: Deploy to production with flag OFF
- [ ] 5.3: Set up monitoring and alerts
- [ ] 5.1: Enable feature flag in production (gradual rollout)
- [ ] 5.3: Monitor for 48 hours
- [ ] Collect user feedback

### Phase 6: Finalization (Week 4)
- [ ] 6.1: Update user documentation
- [ ] 6.1: Update admin documentation
- [ ] Remove feature flag (make permanent)
- [ ] Plan future enhancements
- [ ] Close tickets and merge PR

---

## Risks & Mitigation Strategies

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Cookie domain change logs out all users** | High | Medium | Announce maintenance window; provide clear re-login instructions |
| **ForwardAuth adds latency** | Medium | Low | Optimize DB query; add caching layer; monitor p95 latency |
| **Breaking existing instances** | Low | High | Use feature flag; test thoroughly; rollback plan ready |
| **Security vulnerability if misconfigured** | Low | Critical | Peer review code; security audit; penetration testing |
| **KasmVNC still prompts for auth** | Medium | Medium | Research thoroughly; test multiple approaches; keep fallback |
| **Cross-subdomain cookie issues** | Medium | High | Test across browsers; verify cookie domain propagation |
| **Session hijacking risk** | Low | High | Use secure, httpOnly cookies; monitor for suspicious activity |
| **Database performance degradation** | Low | Medium | Add indexes; implement query caching; load testing |
| **Traefik label conflicts** | Low | Low | Use unique middleware names per instance |
| **Admin access abuse** | Low | Medium | Log all admin access; implement audit trail; alerts on unusual activity |

---

## Success Criteria

### Functional Requirements
- ✅ Users can access their instances without basic auth prompts
- ✅ Non-owners cannot access other users' instances
- ✅ Admins can access any instance
- ✅ Unauthenticated users are redirected to login
- ✅ Session cookies work across all subdomains

### Non-Functional Requirements
- ✅ ForwardAuth latency < 50ms (p95)
- ✅ No increase in container creation time
- ✅ Zero downtime deployment
- ✅ Existing instances continue to work
- ✅ 99.9% success rate for authorized requests

### User Experience
- ✅ Seamless access to instances (no extra login)
- ✅ Clear error messages when access denied
- ✅ No breaking changes to existing workflows
- ✅ Documentation updated and clear

---

## Rollback Plan

### If Issues Occur During Rollout

**Immediate Rollback (< 5 minutes):**
```bash
# 1. Disable feature flag
echo "ENABLE_FORWARDAUTH=false" >> .env

# 2. Rebuild app container
docker-compose up -d --build cloud-viper-gui-app

# 3. Verify instances revert to basic auth
docker logs cloud-viper-gui-app | grep "Creating instance"
```

**Partial Rollback:**
- Keep ForwardAuth endpoint (harmless if not used)
- Disable only label additions (remove from ViperInstanceService)
- Existing instances unaffected
- New instances revert to basic auth

**Full Rollback:**
```bash
# Revert to commit before implementation
git revert {feature-commit-hash}
docker-compose up -d --build
```

**Communication Plan:**
- [ ] Notify users immediately via email/banner
- [ ] Explain temporary reversion to basic auth
- [ ] Provide timeline for fix and re-deployment

---

## Post-Implementation Review

### Metrics to Evaluate After 30 Days
- Total instances created with ForwardAuth
- User satisfaction (survey or support tickets)
- Average ForwardAuth response time
- Number of 403 errors (unauthorized attempts)
- Admin access frequency
- Support tickets related to authentication

### Lessons Learned Session
- What went well?
- What could be improved?
- Unexpected issues encountered
- Performance insights
- User feedback summary

### Next Steps
- Plan future enhancements (instance sharing, etc.)
- Optimize performance if needed
- Expand admin capabilities
- Consider SSO integration (Phase 3)

---

## References & Resources

### Documentation
- [Traefik ForwardAuth Middleware](https://doc.traefik.io/traefik/middlewares/http/forwardauth/)
- [KasmVNC Docker Image](https://github.com/linuxserver/docker-kasmvnc)
- [Express Session Documentation](https://expressjs.com/en/resources/middleware/session.html)
- [Cookie Security Best Practices](https://owasp.org/www-community/controls/SecureFlag)

### Related Files
- `web-app/src/app.ts` - Main application entry
- `web-app/src/services/ViperInstanceService.ts` - Instance creation logic
- `web-app/src/models/ViperInstanceModel.ts` - Database schema
- `web-app/.env` - Environment configuration
- `docker-compose.yml` - Container orchestration

### Team Contacts
- Lead Developer: [Name]
- DevOps/Traefik Expert: [Name]
- Security Review: [Name]
- QA Testing: [Name]

---

## Appendix

### A. Example ForwardAuth Request Flow

```
1. User requests: https://abc123.ddhn.cloudviper.org

2. Traefik intercepts, sees forwardauth middleware

3. Traefik makes sub-request:
   POST https://ddhn.cloudviper.org/auth/verify-instance-access
   Headers:
     X-Forwarded-Host: abc123.ddhn.cloudviper.org
     Cookie: connect.sid=s%3A...
     X-Forwarded-For: 1.2.3.4
     X-Forwarded-Proto: https

4. CloudViPER app processes:
   - Parses UUID from X-Forwarded-Host → "abc123"
   - Checks session → userId = "user-456"
   - Queries database → instance.user_id = "user-456"
   - Returns 200 OK

5. Traefik proxies original request to instance container

6. User sees KasmVNC desktop (no password prompt)
```

### B. Database Schema Additions (Optional)

```sql
-- Add auth_type column to track authentication method
ALTER TABLE viper_instances 
ADD COLUMN auth_type ENUM('basic', 'forwardauth') DEFAULT 'basic';

-- Add access log table for auditing
CREATE TABLE instance_access_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instance_uuid VARCHAR(36) NOT NULL,
  user_id INT NOT NULL,
  access_result ENUM('allowed', 'denied') NOT NULL,
  access_reason ENUM('owner', 'admin', 'unauthorized', 'not_found') NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_instance_uuid (instance_uuid),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

-- Add shared access table for future enhancement
CREATE TABLE instance_shared_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instance_uuid VARCHAR(36) NOT NULL,
  shared_with_user_id INT NOT NULL,
  granted_by_user_id INT NOT NULL,
  access_level ENUM('read', 'full') DEFAULT 'read',
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_share (instance_uuid, shared_with_user_id),
  INDEX idx_shared_with (shared_with_user_id)
);
```

### C. Environment Variables Reference

```bash
# .env additions for ForwardAuth feature

# Feature flag
ENABLE_FORWARDAUTH=false  # Set to 'true' to enable

# Session configuration (may already exist)
SESSION_SECRET=your-secret-here
SESSION_COOKIE_DOMAIN=.ddhn.cloudviper.org  # Leading dot is critical
SESSION_MAX_AGE=604800000  # 7 days in milliseconds

# ForwardAuth endpoint (for Traefik labels)
FORWARDAUTH_URL=https://ddhn.cloudviper.org/auth/verify-instance-access

# Logging
LOG_FORWARDAUTH_REQUESTS=true  # Enable detailed logging
LOG_FORWARDAUTH_FAILURES=true  # Log all 401/403 responses

# KasmVNC auth (research exact variable name)
KASMVNC_DISABLE_AUTH=true  # Or whatever variable name works
```

---

**Plan Version:** 1.0  
**Created:** December 2, 2025  
**Last Updated:** December 2, 2025  
**Status:** Ready for Implementation  
**Estimated Timeline:** 3-4 weeks  
**Priority:** High
