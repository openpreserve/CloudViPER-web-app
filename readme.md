# CloudViPER Web GUI

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

CloudViPER is a powerful cloud-based digital preservation platform that provides automated validation, identification, and characterization of digital files. This repository contains the web interface and container orchestration system for managing ViPER instances.

## Features

- **User Management** - Comprehensive user authentication with role-based access control
- **Container Orchestration** - Docker-based ViPER instance management
- **Team Collaboration** - Team-based resource sharing and management
- **OAuth Integration** - Google OAuth2 authentication support
- **Session Management** - Secure session handling with automatic timeout
- **Email Notifications** - Automated email system for user invitations and password resets
- **Activity Logging** - Comprehensive audit trails for all user actions
- **Rate Limiting** - Protection against abuse with configurable rate limits
- **Security** - CSRF protection, secure password hashing, and SQL injection prevention

## Prerequisites

- Node.js 22.x or higher
- Docker and Docker Compose
- MySQL 8.0 or higher
- npm or yarn package manager

## Quick Start

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/openpreserve/viper-cloud-web-gui.git
   cd viper-cloud-web-gui
   ```

2. **Install dependencies**
   ```bash
   cd web-app
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp src/.env.example src/.env
   # Edit src/.env with your configuration
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

### Docker Deployment

1. **Build and start all services**
   ```bash
   docker compose up -d
   ```

2. **Access the application**
   - Web GUI: `http://localhost:3333`
   - MySQL: `localhost:3306`

## Project Structure

```
viper-cloud-web-gui/
├── web-app/                    # Main application directory
│   ├── src/
│   │   ├── app.ts             # Application entry point
│   │   ├── config/            # Configuration files
│   │   │   ├── auth.ts        # Authentication config
│   │   │   ├── passport.ts    # Passport strategies
│   │   │   └── logger.ts      # Winston logger setup
│   │   ├── middleware/        # Express middleware
│   │   │   └── rateLimiter.ts # Rate limiting
│   │   ├── models/            # Sequelize database models
│   │   │   ├── user.ts        # User model
│   │   │   ├── viperinstance.ts # ViPER instance model
│   │   │   ├── activity.ts    # Activity logging
│   │   │   └── log.ts         # System logs
│   │   ├── routes/            # Express route handlers
│   │   │   ├── account.ts     # User account routes
│   │   │   ├── home.ts        # Public routes
│   │   │   └── service.ts     # ViPER service routes
│   │   ├── services/          # Business logic
│   │   │   ├── ContainerService.ts    # Docker operations
│   │   │   └── ViperInstanceService.ts # Instance management
│   │   ├── types/             # TypeScript type definitions
│   │   │   └── UserRole.ts    # Role enumeration
│   │   ├── utility/           # Helper functions
│   │   │   ├── emailRelay.ts  # Email service
│   │   │   ├── portManager.ts # Port allocation
│   │   │   └── helperFunctions.ts # Utilities
│   │   └── views/             # Handlebars templates
│   │       ├── layouts/       # Page layouts
│   │       └── partials/      # Reusable components
│   ├── scripts/               # Utility scripts
│   └── test/                  # Test suites
├── scripts/                    # Deployment scripts
├── docs/                       # Documentation
└── docker-compose.yml          # Docker orchestration

```

## Configuration

### Environment Variables

Create a `.env` file in the `web-app/src/` directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=cloudviper
DB_USER=root
DB_PASSWORD=your_password

# Application Settings
NODE_ENV=development
PORT=3000
DOMAIN_NAME=cloudviper.org

# Session Secret
SESSION_SECRET=your_secure_random_string

# OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/account/google/callback

# Email Service (MailerSend)
MAILERSEND_API_KEY=your_mailersend_api_key

# Docker Configuration
DOCKER_HOST=unix:///var/run/docker.sock
```

## User Roles

CloudViPER implements a hierarchical role-based access control system:

| Role | Description | Permissions |
|------|-------------|-------------|
| `USER` | Basic user | No ViPER instance access |
| `TESTING` | Testing access | Single ViPER instance for testing |
| `MEMBER` | Community member | Single ViPER instance |
| `TEAM_LEADER` | Team leader | Can invite users and manage team resources |
| `TEAM_ADMIN` | Team administrator | Full team management capabilities |
| `SUBSCRIBER` | Paid subscriber | Extended ViPER instance access |
| `ADMIN` | System administrator | Full system access |

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run coverage
```

## Available Scripts

### Development
- `npm run dev` - Start development server with hot-reloading
- `npm run compile` - Type-check TypeScript without building

### Build
- `npm run build` - Build the application with Gulp
- `npm run build_npm` - Build with npm (TypeScript + copy views)

### Production
- `npm start` - Start production server

### Logging
- `npm run logs:session` - View session logs
- `npm run logs:app` - Tail application logs
- `npm run logs:sql` - Tail SQL query logs

## Docker Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Stop all services
docker compose down

# Rebuild and restart
docker compose up -d --build

# Execute commands in container
docker compose exec app sh
```

## Documentation

- [Development Guide](./DEVELOPMENT.md) - Detailed development workflow
- [Role Enumeration](./docs/ROLE_ENUMERATION.md) - User role system documentation
- [Team Model Implementation](./docs/TEAM-MODEL-IMPLEMENTATION.md) - Team features
- [Container Monitoring](./docs/CONTAINER_MONITORING.md) - Monitoring setup
- [Session Management](./web-app/docs/SESSION_MANAGEMENT.md) - Session handling details

## Security Features

- **CSRF Protection** - Implemented using `@dr.pogodin/csurf`
- **Password Hashing** - bcrypt-based secure password storage
- **Rate Limiting** - Request throttling to prevent abuse
- **SQL Injection Prevention** - Parameterized queries with Sequelize ORM
- **Session Security** - Secure cookie settings and automatic timeout
- **OAuth2 Integration** - Secure Google authentication flow

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built on the ViPER framework for digital preservation
- Powered by the Open Preservation Foundation (OPF)
- Uses Docker for containerization
- Express.js for the web framework
- Sequelize for database ORM

## Support

For support and questions:
- **Email**: sysadmin@openpreservation.org
- **Website**: https://openpreservation.org
- **ViPER Info**: https://viper.openpreservation.org

**CloudViPER** - Secure, scalable digital preservation in the cloud.