# CloudViPER Resource Optimization Plan

## Current System Analysis

### System Overview
- **Total RAM:** 7.6 GB
- **Used RAM:** 7.0 GB (92%)
- **Available RAM:** 624 MB
- **Swap Usage:** 36 MB / 8 GB
- **Status:** ⚠️ **CRITICAL** - System running very close to capacity

### Current Memory Consumption by Service

| Service | Memory Usage | Priority | Optimization Potential |
|---------|-------------|----------|----------------------|
| **MySQL 8.0** | 690 MB | Critical | 🔴 HIGH (can reduce to ~200-300 MB) |
| **Authentik Server** | 528 MB | Medium | 🟡 MEDIUM (can reduce to ~300 MB) |
| **Authentik Worker** | 419 MB | Medium | 🟡 MEDIUM (can reduce to ~200 MB) |
| **ViPER Instance 1** | 398 MB | High | 🔵 LOW (user workload) |
| **ViPER Instance 2** | 260 MB | High | 🔵 LOW (user workload) |
| **CloudViPER App** | 108 MB | Critical | 🟢 ACCEPTABLE |
| **Uptime Kuma** | 106 MB | Low | 🟡 MEDIUM (optional service) |
| **Grafana** | 92 MB | Low | 🟡 MEDIUM (optional monitoring) |
| **Loki** | 81 MB | Low | 🟡 MEDIUM (optional logging) |
| **Prometheus** | 49 MB | Low | 🟡 MEDIUM (optional monitoring) |
| **PHPMyAdmin** | 48 MB | Low | 🟢 ACCEPTABLE |
| **Authentik DB (Postgres)** | 49 MB | Medium | 🟢 ACCEPTABLE |
| **Promtail** | 45 MB | Low | 🟡 MEDIUM (optional logging) |
| **Traefik** | 40 MB | Critical | 🟢 ACCEPTABLE |

### Resource Allocation Issues

**Problem Breakdown:**
1. **MySQL using 690 MB** (should be ~200-300 MB for this workload)
2. **Authentik Stack using 996 MB** (server + worker + db + redis)
3. **Monitoring Stack using 268 MB** (Grafana + Loki + Prometheus + Promtail)
4. **Only ~624 MB available** for new ViPER instances

**Impact on ViPER Instances:**
- Each ViPER instance needs ~400 MB RAM
- Currently can only run ~1.5 instances comfortably
- System thrashing likely when 3+ instances running
- Risk of OOM killer terminating containers

---

## Optimization Strategy

### Priority 1: IMMEDIATE - MySQL Optimization (Save ~400 MB)

**Current State:**
```
innodb_buffer_pool_size: 134 MB (128 MB)
table_open_cache: 4000 (excessive for small DB)
```

**Problem:** MySQL 8.0 has high default memory allocation designed for dedicated database servers, not shared container environments.

**Solution: Tune MySQL for Low-Memory Environment**

#### Actions:
1. Create MySQL configuration file with optimized settings
2. Mount as volume in docker-compose
3. Restart MySQL container

**Expected Result:** Reduce MySQL from 690 MB → 200-250 MB (~450 MB saved)

---

### Priority 2: HIGH - Authentik Optimization (Save ~300-400 MB)

**Current State:**
- Authentik Server: 528 MB
- Authentik Worker: 419 MB
- Total: 947 MB

**Problem:** Authentik is enterprise SSO/IAM system - very heavyweight for single tenant.

**Options:**

#### Option A: Optimize Authentik (Moderate savings)
- Set resource limits in docker-compose
- Reduce worker processes
- Use lighter database backend
- **Savings:** ~200 MB (Total: 747 MB)

#### Option B: Evaluate Need for Authentik (High savings)
- Currently using Google OAuth for authentication
- ForwardAuth plan doesn't require Authentik
- Authentik adds complexity but unused features
- **Savings:** ~1000 MB (Remove entire stack)
- **Trade-off:** Lose enterprise SSO features

**Recommendation:** Option B (Remove Authentik) - Not currently utilized, can re-add later if needed for enterprise SSO.

---

### Priority 3: MEDIUM - Monitoring Stack Optimization (Save ~150-200 MB)

**Current State:**
- Grafana: 92 MB
- Loki: 81 MB
- Prometheus: 49 MB
- Promtail: 45 MB
- Uptime Kuma: 106 MB
- Total: 373 MB

**Problem:** Running full monitoring stack on small server with limited resources.

**Options:**

#### Option A: Keep Essential, Remove Rest
- **Keep:** Uptime Kuma (simple health checks)
- **Remove:** Grafana, Loki, Prometheus, Promtail
- **Savings:** ~268 MB

#### Option B: External Monitoring
- Use external service (UptimeRobot, Pingdom, etc.)
- Remove all monitoring containers
- **Savings:** ~373 MB

#### Option C: Lightweight Alternative
- Replace with single lightweight monitor (e.g., simple healthcheck script)
- **Savings:** ~350 MB

**Recommendation:** Option A - Keep Uptime Kuma for basic monitoring, remove heavy log aggregation.

---

### Priority 4: LOW - Optional Services Review

**Services to Evaluate:**

1. **PHPMyAdmin (48 MB)**
   - Used for database administration
   - Can use SSH tunnel + local client instead
   - **Recommendation:** Keep for convenience

2. **Portainer (30 MB)**
   - Docker management UI
   - Useful for administration
   - **Recommendation:** Keep (minimal overhead)

3. **Dozzle (Container logs viewer)**
   - Not in stats but likely running
   - **Recommendation:** Keep if < 50 MB

---

## Implementation Plan

### Phase 1: MySQL Optimization (IMMEDIATE)

**Estimated Time:** 15 minutes  
**Expected Savings:** ~450 MB  
**Risk:** Low (backup database first)

#### Steps:

1. **Create MySQL configuration file:**

```bash
# Create custom MySQL config
cat > /var/docker-stacks/viper-cloud-web-gui/mysql-config/my.cnf << 'EOF'
[mysqld]
# Basic Settings
default_authentication_plugin = mysql_native_password
skip-log-bin

# Performance Schema - Disable for memory savings
performance_schema = OFF

# Connection Settings
max_connections = 50
connect_timeout = 10
wait_timeout = 600

# Memory Settings - Optimized for 8GB RAM server
innodb_buffer_pool_size = 128M          # Reduced from 134MB
innodb_log_buffer_size = 8M             # Small log buffer
innodb_sort_buffer_size = 256K          # Minimal sort buffer

# MyISAM Settings
key_buffer_size = 8M                    # Keep at 8MB
myisam_sort_buffer_size = 512K          # Reduced

# Query Cache (disabled in MySQL 8)
query_cache_size = 0
query_cache_type = 0

# Table Cache
table_open_cache = 400                  # Reduced from 4000
table_definition_cache = 400            # Match table_open_cache

# Thread Settings
thread_cache_size = 8
thread_stack = 256K                     # Reduced from default

# Temp Tables
tmp_table_size = 16M                    # Small temp tables
max_heap_table_size = 16M               # Match tmp_table_size

# Per-Connection Buffers (keep small)
sort_buffer_size = 128K                 # Reduced from 262K
read_buffer_size = 128K
read_rnd_buffer_size = 128K
join_buffer_size = 128K

# InnoDB Settings
innodb_flush_method = O_DIRECT
innodb_flush_log_at_trx_commit = 2      # Better performance, slight durability trade-off
innodb_file_per_table = 1
innodb_buffer_pool_instances = 1        # Single instance for small buffer pool

# Logging
slow_query_log = 0                      # Disable for memory savings
general_log = 0                         # Disable for memory savings
log_error_verbosity = 2                 # Reduce log verbosity

# Binary Logging (already disabled in command)
expire_logs_days = 3                    # Keep logs for 3 days only

# Character Set
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
EOF
```

2. **Update docker-compose.yml:**

```yaml
mysqldb:
  image: mysql:8.0
  container_name: cloud-viper-mysqldb
  restart: always
  env_file: ./web-app/.env
  environment:
    EXPIRE_LOGS_DAYS: 3
  deploy:
    resources:
      limits:
        memory: 300M      # Hard limit
      reservations:
        memory: 200M      # Minimum guarantee
  ports:
    - 3306:3306
  volumes:
    - ./volumes/mysql_8_data:/var/lib/mysql
    - ./mysql-config/my.cnf:/etc/mysql/conf.d/custom.cnf:ro
  command: --default-authentication-plugin=mysql_native_password --skip-log-bin --performance-schema=OFF
  healthcheck:
    test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
    timeout: 20s
    retries: 10
  networks:
    - cloud-viper-net
```

3. **Apply changes:**

```bash
# Backup database first!
docker exec cloud-viper-mysqldb sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --all-databases' > /tmp/mysql_backup_$(date +%Y%m%d).sql

# Create config directory
mkdir -p /var/docker-stacks/viper-cloud-web-gui/mysql-config

# Recreate container with new config
cd /var/docker-stacks/viper-cloud-web-gui
docker-compose up -d mysqldb
```

4. **Verify optimization:**

```bash
# Wait 30 seconds for MySQL to stabilize
sleep 30

# Check new memory usage
docker stats --no-stream cloud-viper-mysqldb --format "table {{.Name}}\t{{.MemUsage}}"

# Verify MySQL is working
docker exec cloud-viper-mysqldb sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES;"'
```

---

### Phase 2: Remove Authentik Stack (HIGH PRIORITY)

**Estimated Time:** 10 minutes  
**Expected Savings:** ~1000 MB  
**Risk:** Low (not currently used by CloudViPER)

#### Validation Check:

```bash
# Verify CloudViPER is NOT using Authentik
grep -r "authentik" /var/docker-stacks/viper-cloud-web-gui/web-app/src/ || echo "Not using Authentik"

# Check Traefik for Authentik middleware
docker exec traefik cat /etc/traefik/traefik.yml | grep -i authentik || echo "Not configured"
```

#### If Not Used - Remove:

```bash
# Stop and remove Authentik containers
cd /var/docker-stacks/ingress-traefik  # or wherever authentik compose file is
docker-compose down authentik-server authentik-worker authentik-db authentik-redis

# Or if separate compose file:
docker stop authentik-server authentik-worker authentik-db authentik-redis
docker rm authentik-server authentik-worker authentik-db authentik-redis

# Verify removal
docker ps | grep authentik || echo "Authentik removed successfully"
```

**Alternative - If Needed:** Add resource limits:

```yaml
authentik-server:
  deploy:
    resources:
      limits:
        memory: 300M
      reservations:
        memory: 200M

authentik-worker:
  deploy:
    resources:
      limits:
        memory: 200M
      reservations:
        memory: 150M
```

---

### Phase 3: Optimize Monitoring Stack (MEDIUM PRIORITY)

**Estimated Time:** 10 minutes  
**Expected Savings:** ~268 MB  
**Risk:** Low (can re-add if needed)

#### Keep Uptime Kuma, Remove Others:

```bash
# Stop heavy monitoring containers
docker stop grafana loki prometheus promtail
docker rm grafana loki prometheus promtail

# Keep Uptime Kuma for basic health checks
docker ps | grep uptime-kuma
```

#### Update docker-compose (remove services):

Remove or comment out these services from monitoring stack compose file:
- grafana
- loki
- prometheus
- promtail

---

### Phase 4: Add Resource Limits to All Services

**Estimated Time:** 20 minutes  
**Expected Savings:** Better resource control, prevent OOM  
**Risk:** Low (prevents runaway processes)

#### Add limits to docker-compose.yml:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 200M
        reservations:
          memory: 100M
  
  phpmyadmin:
    deploy:
      resources:
        limits:
          memory: 100M
        reservations:
          memory: 50M
  
  # Add similar limits to all infrastructure services
```

---

## ViPER Instance Optimization

### Current Issue:
Each ViPER instance (KasmVNC desktop) uses ~300-400 MB RAM

### Options:

#### Option 1: Set Memory Limits per Instance
```typescript
// In ViperInstanceService.ts
const containerOptions = {
  HostConfig: {
    Memory: 512 * 1024 * 1024,        // 512 MB limit
    MemoryReservation: 256 * 1024 * 1024,  // 256 MB guaranteed
    MemorySwap: 768 * 1024 * 1024,    // 768 MB total (RAM + Swap)
    // ... existing options
  }
};
```

#### Option 2: Optimize KasmVNC Settings
```javascript
// Add environment variables to reduce memory usage
const envVars = {
  PUID: '1000',
  PGID: '1000',
  // KasmVNC optimizations
  VNC_RESOLUTION: '1280x720',     // Lower resolution
  VNC_COL_DEPTH: '16',            // 16-bit color instead of 24
  DISPLAY: ':1',
  // Disable unnecessary features
  DISABLE_AUDIO: 'true',          // If not needed
};
```

#### Option 3: User Quotas
- Set maximum instances per user (e.g., 2 max)
- Implement auto-stop for idle instances (> 1 hour)
- Add "Stop All Instances" button for users

---

## Expected Results After All Optimizations

| Optimization | Memory Saved | New Total Available |
|--------------|--------------|---------------------|
| **Starting Point** | - | 624 MB available |
| MySQL Optimization | +450 MB | 1074 MB |
| Remove Authentik | +1000 MB | 2074 MB |
| Reduce Monitoring | +268 MB | 2342 MB |
| **Total Available** | **+1718 MB** | **~2.3 GB for instances** |

**Instance Capacity:**
- **Before:** ~1-2 instances
- **After:** **5-6 instances** comfortably
- **Peak:** 7-8 instances (with some swap usage)

---

## Monitoring & Alerts

### Set Up Resource Monitoring Script:

```bash
#!/bin/bash
# /var/docker-stacks/scripts/resource-monitor.sh

# Alert if RAM usage > 85%
USED=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
if (( $(echo "$USED > 85" | bc -l) )); then
    echo "⚠️  WARNING: RAM usage at ${USED}%" | wall
    # Optional: Send email or notification
fi

# Check individual container memory
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}" | \
  awk '$3 ~ /%/ && $3+0 > 80 {print "⚠️  Container "$1" using "$2" ("$3")"}'
```

### Add to crontab:

```bash
# Check every 5 minutes
*/5 * * * * /var/docker-stacks/scripts/resource-monitor.sh
```

---

## Alternative: Consider Upgrading RAM

### Cost-Benefit Analysis:

**Current:** 8 GB RAM (~$20-40/month hosting)
**Upgrade:** 16 GB RAM (~$40-80/month hosting)

**Justification:**
- If planning to support 10+ concurrent instances
- If Authentik/monitoring is actually needed
- If want to avoid optimization complexity

**Break-even:**
- Cost: +$20-40/month
- Benefit: 2x capacity, less management overhead
- If hosting >5 users regularly, upgrade may be worth it

---

## Rollback Plan

### If Issues Occur:

**MySQL optimization problems:**
```bash
# Remove custom config
cd /var/docker-stacks/viper-cloud-web-gui
rm mysql-config/my.cnf

# Restore from backup
docker exec -i cloud-viper-mysqldb sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < /tmp/mysql_backup_20251202.sql

# Restart
docker-compose restart mysqldb
```

**Authentik needed:**
```bash
# Re-enable in docker-compose and start
docker-compose up -d authentik-server authentik-worker authentik-db authentik-redis
```

**Monitoring needed:**
```bash
# Restart monitoring stack
docker-compose up -d grafana loki prometheus promtail
```

---

## Implementation Timeline

### Immediate (Today):
- ✅ Phase 1: MySQL optimization (15 min)
- ✅ Test MySQL and app functionality (15 min)

### Short-term (This Week):
- ✅ Phase 2: Evaluate and remove Authentik (30 min)
- ✅ Phase 3: Reduce monitoring stack (15 min)
- ✅ Add resource limits to compose files (30 min)
- ✅ Test instance creation and stability (30 min)

### Medium-term (Next Week):
- Add per-instance memory limits
- Implement auto-stop for idle instances
- Set user quotas
- Add resource monitoring alerts

---

## Testing Checklist

After each optimization phase:

- [ ] Check system available RAM: `free -h`
- [ ] Verify all containers running: `docker ps`
- [ ] Test CloudViPER app login and navigation
- [ ] Create test ViPER instance
- [ ] Access instance and verify functionality
- [ ] Stop instance and check cleanup
- [ ] Monitor for 30 minutes for stability
- [ ] Check logs for errors: `docker-compose logs --tail=50`

---

## Recommendations Summary

### Must Do (Critical):
1. ✅ **MySQL optimization** - Save ~450 MB immediately
2. ✅ **Remove or limit Authentik** - Save ~1000 MB if not used
3. ✅ **Add resource limits** - Prevent OOM killer

### Should Do (Important):
4. ✅ **Reduce monitoring stack** - Save ~268 MB
5. ✅ **Instance memory limits** - Ensure predictable resource usage
6. ✅ **Auto-stop idle instances** - Free resources automatically

### Nice to Have (Future):
7. User quotas (max instances per user)
8. Resource usage dashboard for users
9. Upgrade to 16 GB RAM if budget allows

---

**Total Expected Savings:** ~1.7 GB  
**New Instance Capacity:** 5-6 concurrent instances  
**Risk Level:** Low (all changes reversible)  
**Estimated Implementation Time:** 2 hours total

---

**Document Version:** 1.0  
**Created:** December 2, 2025  
**Status:** Ready for Implementation  
**Priority:** HIGH - System currently at 92% memory usage
