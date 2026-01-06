---
layout: default
title: Getting Started
description: Quick start guide for CloudViPER
---

# Getting Started

This guide will help you get CloudViPER up and running on your system.

---

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Docker:** Version 20.10 or later
- **Docker Compose:** Version 2.0 or later
- **Git:** For cloning the repository
- **Sufficient disk space:** At least 5GB for containers and data volumes

**Note:** CloudViPER has been tested on Linux systems. Windows and macOS support may require additional configuration.

---

## Installation

### Step 1: Clone the Repository

Clone the CloudViPER repository from GitHub:

```bash
git clone https://github.com/openpreserve/CloudViPER-web-app.git
cd CloudViPER-web-app
```

### Step 2: Configure Environment Variables

Create a `.env` file in the root directory with your configuration:

```bash
# Database Configuration
MYSQL_ROOT_PASSWORD=your_secure_password
MYSQL_DATABASE=viper_db_production
MYSQL_USER=viper_user
MYSQL_PASSWORD=your_db_password

# Application Configuration
NODE_ENV=production
SESSION_SECRET=your_session_secret
PORT=3000
```

**Security Warning:** Always use strong, unique passwords for production deployments. Never commit your `.env` file to version control.

### Step 3: Launch Services

Use Docker Compose to build and start all services:

```bash
docker-compose up -d
```

This command will:

- Build the application Docker image
- Start the MySQL database container
- Initialize the database schema
- Launch the web application

### Step 4: Verify Installation

Check that all containers are running:

```bash
docker-compose ps
```

You should see the following containers in a "Up" state:

- `viper-web-app`
- `viper-mysql`

---

## First Login

Once the services are running, access the web interface:

1. Open your web browser
2. Navigate to `http://localhost:3000`
3. Log in with the default administrator credentials:
   - **Username:** admin
   - **Password:** (set during initial setup)

**Important:** Change the default administrator password immediately after first login.

---

## Basic Configuration

### User Management

Create additional users through the admin interface:

1. Navigate to **Admin** > **User Management**
2. Click **Add New User**
3. Fill in user details and assign appropriate roles
4. Click **Create User**

### Container Monitoring

Enable container monitoring to track system resources:

1. Navigate to **Settings** > **Monitoring**
2. Enable the monitoring service
3. Configure refresh intervals and alert thresholds

---

## Next Steps

- [Documentation]({{ '/documentation/' | relative_url }}) - Explore detailed documentation for advanced features
- [Report Issues](https://github.com/openpreserve/CloudViPER-web-app/issues) - Join our community or report issues on GitHub

---

## Troubleshooting

### Containers Won't Start

If containers fail to start, check the logs:

```bash
docker-compose logs -f
```

### Cannot Connect to Database

Verify that the MySQL container is running and accessible:

```bash
docker-compose exec mysql mysql -u root -p
```

### Port Already in Use

If port 3000 is already in use, modify the port mapping in `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"  # Change 8080 to any available port
```

**Need More Help?** Check our [full documentation]({{ '/documentation/' | relative_url }}) or open an issue on [GitHub](https://github.com/openpreserve/CloudViPER-web-app/issues).
