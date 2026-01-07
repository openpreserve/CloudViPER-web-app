# Database Initialization & Admin User Setup

## Overview

This document describes the comprehensive database initialization and initial admin user creation system for the viper-cloud-web-gui application, designed for production deployment to Google Marketplace with zero manual intervention.

## Components

### 1. Database Schema Initialization

**File:** `/k8s/db-init-configmap.yaml`

The init container in the viper-app deployment runs an SQL script that creates all required database tables:

- **Users** - User accounts with authentication (hash/salt), roles, team management
- **ViperInstances** - Virtual desktop instances with status, logs, activity tracking
- **Screenshots** - Screenshot data for instance monitoring
- **Activities** - Activity metrics (mouse/keyboard events, CPU/memory usage)
- **sessions** - Express session storage

The SQL schema matches the Sequelize models exactly to prevent synchronization issues.

### 2. Initial Admin User Creation

**Files:**
- `/web-app/src/utility/initializeAdmin.ts` - Admin initialization logic
- `/web-app/src/models/index.ts` - Database sync + admin initialization
- `/k8s/viper-app-secret.yaml` - Initial admin credentials (base64 encoded)

#### How It Works

1. **After database sync completes**, the app automatically calls `initializeAdminUser()`
2. **Checks for existing admin users** - if any admin exists, skips creation
3. **Reads credentials from environment variables**:
   - `INITIAL_ADMIN_USERNAME` (default: "admin")
   - `INITIAL_ADMIN_EMAIL` (default: "admin@example.com")
   - `INITIAL_ADMIN_PASSWORD` (default: "ChangeMeOnFirstLogin123!")
4. **Creates admin user** with role set to `'admin'` using the User.register() method
5. **Logs the operation** for audit trail
6. **Displays credentials** in console for first-time setup

#### Default Admin Credentials

For Google Marketplace deployments, the default admin user will be created with:

```
Username: admin
Email:    admin@example.com
Password: ChangeMeOnFirstLogin123!
```

**⚠️ IMPORTANT:** Users should change this password immediately after first login!

### 3. Environment Variable Configuration

The initial admin credentials are stored in the Kubernetes secret:

```yaml
# /k8s/viper-app-secret.yaml
data:
  INITIAL_ADMIN_USERNAME: YWRtaW4=              # base64("admin")
  INITIAL_ADMIN_EMAIL: YWRtaW5AZXhhbXBsZS5jb20= # base64("admin@example.com")
  INITIAL_ADMIN_PASSWORD: Q2hhbmdlTWVPbkZpcnN0TG9naW4xMjMh # base64("ChangeMeOnFirstLogin123!")
```

These can be customized before deployment by encoding different values:

```bash
echo -n "your-username" | base64
echo -n "your-email@example.com" | base64
echo -n "YourSecurePassword123!" | base64
```

### 4. Deployment Flow

#### Init Container Flow:
1. Wait for MySQL to be ready (health check loop)
2. Run `init-db.sql` to create all tables
3. Exit successfully

#### App Container Flow:
1. Start Express application
2. Initialize Sequelize and connect to database
3. Run database sync (alter mode in production)
4. **Call `initializeAdminUser()`**
5. Begin accepting requests

### 5. Production Considerations

#### Security
- Initial password is strong but temporary
- Password is hashed using PBKDF2 with 25,000 iterations
- Admin credentials should be changed immediately after first login
- Secret values are base64-encoded in Kubernetes (should use Sealed Secrets or external secret management in production)

#### Idempotency
- Admin initialization is idempotent - it can run multiple times safely
- Only creates admin if NO admin users exist
- Will not create duplicate users or fail on subsequent runs

#### Error Handling
- If admin creation fails, the app still starts (non-blocking)
- Errors are logged for troubleshooting
- Prevents deployment failures due to transient DB issues

#### Logging
- All operations are logged using Winston (appLogger)
- Includes timestamps, user details, and operation results
- Console output shows credentials on first creation for easy access

## Testing the Setup

### From Scratch
1. **Delete existing database data:**
   ```bash
   sudo rm -rf /mnt/k8s_mysql_data/*
   ```

2. **Restart Tilt:**
   ```bash
   tilt down
   tilt up
   ```

3. **Check logs for admin creation:**
   ```bash
   kubectl logs -f deployment/viper-app -c viper-app
   ```

   You should see:
   ```
   ═══════════════════════════════════════════════════
   ✓ Initial admin user created successfully
     Username: admin
     Email:    admin@example.com
     Password: ChangeMeOnFirstLogin123!
     ⚠ IMPORTANT: Change the password after first login!
   ═══════════════════════════════════════════════════
   ```

4. **Access Adminer to verify:**
   - URL: http://localhost:30081
   - Login with MySQL credentials from secret
   - Check Users table for admin user with role='admin'

5. **Test login:**
   - Navigate to http://localhost:30080/account/login
   - Login with admin credentials
   - Verify admin functionality

### Verifying Schema
```sql
-- Connect via Adminer or MySQL client
USE viper_db;

-- Check all tables exist
SHOW TABLES;

-- Verify Users table structure
DESCRIBE Users;

-- Check for admin user
SELECT id, username, email, role, team, createdAt FROM Users WHERE role='admin';

-- Verify foreign keys
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME IS NOT NULL
  AND TABLE_SCHEMA = 'viper_db';
```

## Customization for Google Marketplace

Before publishing to Google Marketplace:

1. **Update Secret with Strong Password:**
   ```bash
   # Generate a strong random password
   STRONG_PASSWORD=$(openssl rand -base64 32)
   echo -n "$STRONG_PASSWORD" | base64
   # Update INITIAL_ADMIN_PASSWORD in viper-app-secret.yaml
   ```

2. **Consider Adding Password Reset Flow:**
   - Force password change on first login
   - Send email with password reset instructions
   - Use the existing `resetPasswordToken` and `resetPasswordExpires` fields

3. **Update Documentation:**
   - Include default credentials in deployment guide
   - Add security warning about changing password
   - Document admin access URL

4. **Add Health Checks:**
   - The deployment already has liveness/readiness probes
   - Consider adding a dedicated `/health` endpoint for better monitoring

## Maintenance

### Changing Admin Credentials
If you need to change the initial admin credentials after deployment:

```bash
# Update the secret
kubectl create secret generic viper-app-secret \
  --from-literal=INITIAL_ADMIN_USERNAME=newadmin \
  --from-literal=INITIAL_ADMIN_EMAIL=newadmin@example.com \
  --from-literal=INITIAL_ADMIN_PASSWORD=NewSecurePass123! \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart the deployment
kubectl rollout restart deployment/viper-app
```

### Resetting to Fresh State
To completely reset the database and admin user:

```bash
# Delete the database data
sudo rm -rf /mnt/k8s_mysql_data/*

# Restart everything
kubectl delete pod -l app=mysql
kubectl delete pod -l app=viper-app
```

The init container will recreate all tables, and the app will create a fresh admin user on startup.

## Files Modified

1. ✅ `/k8s/viper-app-secret.yaml` - Added INITIAL_ADMIN_* credentials
2. ✅ `/k8s/db-init-configmap.yaml` - Fixed SQL schema to match Sequelize models
3. ✅ `/web-app/src/utility/initializeAdmin.ts` - New admin initialization utility
4. ✅ `/web-app/src/models/index.ts` - Added admin initialization call after DB sync

## Benefits

✅ **Zero Manual Intervention** - Fully automated setup for marketplace deployment
✅ **Production Ready** - Proper error handling, logging, idempotency
✅ **Secure by Default** - Strong password hashing, temporary initial password
✅ **Maintainable** - Clear separation of concerns, well-documented
✅ **Flexible** - Easy to customize credentials via environment variables
✅ **Auditable** - Comprehensive logging of all operations

---

**Last Updated:** 2025-01-30
**Status:** ✅ Implemented and ready for testing
