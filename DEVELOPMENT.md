# Development Guide

## Local Development with Live Reloading

### Quick Start

The easiest way to run the application locally with automatic reloading:

```bash
cd web-app
npm run dev
```

This will:
- ✅ Start the Express server with TypeScript hot-reloading
- ✅ Auto-restart when you change `.ts` files
- ✅ Reload Handlebars views on browser refresh (no server restart needed)
- ✅ Fast transpilation without type checking (use `npm run compile` to check types)

### What Gets Reloaded

| File Type | Reload Method | Notes |
|-----------|---------------|-------|
| `.ts` files | Automatic server restart | Changes detected by `ts-node-dev` |
| `.handlebars` views | Browser refresh | View cache disabled in dev mode |
| Static files in `public/` | Browser refresh | Served directly from `src/public` |
| `.env` changes | Manual restart needed | Environment variables loaded on startup |

### Development Workflow

1. **Start the dev server:**
   ```bash
   cd web-app
   npm run dev
   ```

2. **Make changes:**
   - Edit TypeScript files → Server auto-restarts
   - Edit Handlebars templates → Just refresh browser
   - Edit CSS/JS in `public/` → Just refresh browser

3. **Run tests while developing:**
   ```bash
   # In another terminal
   npm run test:watch
   ```

4. **View logs:**
   ```bash
   # Session logs
   npm run logs:session
   
   # Application logs
   npm run logs:app
   
   # SQL logs
   npm run logs:sql
   ```

### Environment Setup

Make sure you have a `.env` file in `web-app/src/` with required variables:

```bash
cp src/.env.example src/.env
# Edit src/.env with your local settings
```

### Docker Services

If you need the MySQL database and other services:

```bash
# Start all services
docker compose up -d

# Or just the database
docker compose up -d mysql

# Stop all services
docker compose down
```

### Production Build

When ready to deploy:

```bash
# Compile TypeScript and copy views/static files
npm run build

# Start production server
npm start
```

### Troubleshooting

**Views not updating?**
- Make sure `NODE_ENV=dev` is set (automatically set by `npm run dev`)
- Hard refresh browser: `Ctrl+Shift+R` (Linux/Windows) or `Cmd+Shift+R` (Mac)

**Port already in use?**
- Check if another instance is running: `lsof -i :3000`
- Kill the process or change port in `.env`

**TypeScript errors?**
- `npm run dev` uses `--transpile-only` for speed
- Run `npm run compile` to see all TypeScript errors

**Database connection issues?**
- Ensure MySQL container is running: `docker ps`
- Check database credentials in `.env`

### VS Code Debug Configuration

Use the VS Code debugger with breakpoints:

1. Press `F5` or go to Run → Start Debugging
2. Select "Launch via NPM" configuration
3. Set breakpoints in your `.ts` files
4. Debug with full TypeScript support

