---
layout: default
title: Documentation
description: Comprehensive documentation for CloudViPER
---

# Documentation

Comprehensive guide to using and deploying CloudViPER.

---

## Overview

CloudViPER is a web-based interface for managing Docker containers with a focus on digital preservation workflows. It provides secure authentication, role-based access control, and comprehensive monitoring capabilities.

**Key Concepts:**

- **Containers:** Isolated application environments managed through Docker
- **Roles:** User permission levels (Admin, User, Guest)
- **Sessions:** Authenticated user sessions with configurable timeouts
- **Monitoring:** Real-time resource tracking and alerts

---

## Architecture

The application follows a modern three-tier architecture:

### Presentation Layer
Express.js web server with EJS templates for server-side rendering

### Application Layer
TypeScript business logic with service-oriented architecture

### Data Layer
MySQL database for persistent storage and session management

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js | JavaScript execution environment |
| Language | TypeScript | Type-safe development |
| Web Framework | Express.js | HTTP server and routing |
| Database | MySQL 8 | Data persistence |
| Containerization | Docker | Application packaging and deployment |

---

## Features

### User Management

Comprehensive user account management with role-based access control:

- Create, update, and delete user accounts
- Assign roles: Admin, User, Guest
- Password reset and account recovery
- Session management with configurable timeouts

### Container Operations

Full Docker container lifecycle management:

- List all containers with status information
- Start, stop, restart containers
- View container logs and inspect configuration
- Monitor resource usage (CPU, memory, disk)

### Security Features

Enterprise-grade security measures:

- Secure password hashing with bcrypt
- CSRF protection for form submissions
- Session-based authentication
- Audit logging for security events
- Rate limiting to prevent abuse

---

## API Reference

CloudViPER provides a REST API for programmatic access. All API endpoints require authentication.

### Authentication

**POST** `/api/auth/login`  
Authenticate and receive session cookie

### Containers

**GET** `/api/containers`  
List all containers

**POST** `/api/containers/:id/start`  
Start a container

**POST** `/api/containers/:id/stop`  
Stop a container

---

## Security

Security is a top priority for CloudViPER. The application implements multiple layers of security.

**Security Best Practices:**

- Always use HTTPS in production environments
- Regularly update dependencies to patch vulnerabilities
- Use strong, unique passwords for all accounts
- Enable audit logging and review logs regularly
- Restrict network access to trusted sources

---

## Deployment

For detailed deployment instructions, see the [Getting Started]({{ '/getting-started/' | relative_url }}) guide.

### Production Considerations

- **Reverse Proxy:** Use nginx or Apache as a reverse proxy
- **SSL/TLS:** Configure HTTPS with valid certificates
- **Backups:** Implement regular database backups
- **Monitoring:** Set up monitoring and alerting
- **Scaling:** Consider load balancing for high-traffic deployments

---

**Need Help?** If you can't find what you're looking for, please [open an issue](https://github.com/openpreserve/CloudViPER-web-app/issues) on GitHub.
