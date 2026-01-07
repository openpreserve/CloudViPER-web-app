# ViPER Cloud Web App - Version Changelog

This document tracks all versioned releases of the web-app container image.

## Version History

| Version | Date | Time (CET) | Changes | Image Digest |
|---------|------|------------|---------|--------------|
| v0.0.0 | 2025-10-28 | 23:52 | **Initial GKE deployment with monitoring** <br/>• Implemented Kubernetes Exec API for runtime script injection<br/>• Added async pod monitoring setup (120s timeout)<br/>• Monitoring scripts: viper-monitor.sh, systemd service, autostart<br/>• Security: Sudo removal via runtime injection<br/>• Status tracking: creating → initializing → ready<br/>• Dependencies: scrot, xdotool, curl, bc, xinput<br/>• Activity tracking: mouse events, CPU, memory<br/>• Screenshots: every 30s, base64 encoded<br/>• Increased pod readiness wait from 60s to 120s | `sha256:ee5c688a...` |

## Image Repository

```
europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app
```

## Build & Deploy Commands

### Build
```bash
docker build -t europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:vX.Y.Z -f Dockerfile .
docker tag europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:vX.Y.Z \
           europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:latest
```

### Push
```bash
docker push europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:vX.Y.Z
docker push europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:latest
```

### Deploy
```bash
kubectl rollout restart deployment viper-app
kubectl rollout status deployment viper-app --timeout=120s
```

### Rollback to Specific Version
```bash
kubectl set image deployment/viper-app viper-app=europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:vX.Y.Z
kubectl rollout status deployment viper-app --timeout=120s
```

## Versioning Strategy

- **v0.x.x** - Pre-production development and testing
- **v1.x.x** - Production-ready releases
- **Patch (x.x.X)** - Bug fixes, minor improvements
- **Minor (x.X.x)** - New features, non-breaking changes
- **Major (X.x.x)** - Breaking changes, major refactors

## Notes

- The `latest` tag always points to the most recent version
- All versions are immutable once pushed
- Keep this changelog updated with each new version
- Include relevant commit hashes or PR references when applicable
