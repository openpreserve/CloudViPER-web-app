import express, { Application } from 'express';
import exphbs from './config/handlebars';
import bodyParser from 'body-parser';
import passport from 'passport';
import flash from 'connect-flash';
import db from './models';
import { logSession, appLogger } from './config/logger';

import configAuth from './config/auth';

import dotenv from 'dotenv';
dotenv.config({ path: `${__dirname}/.env` });

console.log(`DB USER: ${process.env.DB_USER}`);

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);
const secure_cookie = (process.env.NODE_ENV === 'production') ? true || false : false;

// Log application startup
appLogger.info('Application starting', {
    nodeEnv: process.env.NODE_ENV,
    port: PORT,
    dbUser: process.env.DB_USER,
    timestamp: new Date().toISOString()
});

// Begin server setup
// Health check endpoint - must be first, before any authentication or redirects
app.get('/healthz', async (req, res) => {
    try {
        // Quick database check
        await db.sequelize.authenticate();
        res.status(200).json({ 
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'error',
            message: 'Database connection failed',
            timestamp: new Date().toISOString()
        });
    }
});

app.use( bodyParser.urlencoded({ extended: true}) );
app.use( bodyParser.json({ limit: '10mb' }) ); // Add JSON body parser with 10MB limit for screenshots
let path = require('path');
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Get domain name from environment variable
const DOMAIN_NAME = process.env.DOMAIN_NAME || 'cloudviper.org';
const DOMAIN_WITHOUT_WWW = DOMAIN_NAME.replace('www.', '');

// Prod specific 
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next)=>{
        // Allow internal Docker network requests to bypass HTTPS redirect
        const isInternalRequest = 
            req.ip?.startsWith('172.') || // Docker internal network
            req.ip?.startsWith('10.') ||  // Docker internal network
            req.hostname === 'cloud-viper-gui-app' ||
            req.hostname === 'localhost';
        
        const isServiceEndpoint = req.path.startsWith('/service/');
        
        // Skip HTTPS redirect for internal service requests
        if (isInternalRequest && isServiceEndpoint) {
            console.log('Bypassing HTTPS redirect for internal request:', {
                ip: req.ip,
                hostname: req.hostname,
                path: req.path,
                timestamp: new Date().toISOString()
            });
            return next();
        }
        
        //force https for external requests
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(302, [`https://${DOMAIN_NAME}`, req.url].join('')); 
        }
        next();
    });
}

// Sessions
import session from 'express-session'
const MySQLStore = require('express-mysql-session')(session);
const sessionStoreOptions = {
    ...configAuth.mysqlSessionAuth,
    createDatabaseTable: true, // Automatically create sessions table if it doesn't exist
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
};
const SQLStore = new MySQLStore(sessionStoreOptions);
let session_config: session.SessionOptions = {
    name: "vipercloud.sid",
    cookie: { maxAge: ((4 * 24) * 60 * 60 * 1000), secure: secure_cookie }, // 4 days
    store: SQLStore,
    secret: process.env.APP_COOKIE_SECRET || 'default_secret', // Replace with your own secret key
    resave: false,
    saveUninitialized: false,
};

// Add session to app
const sessionMW = session(session_config);
app.use(sessionMW);
app.use(flash());

// Configure passport
app.use(passport.initialize());
app.use(passport.session());
import configurePassport from './config/passport';
// import { default } from './config/passport';
configurePassport(passport);

// View Engine
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', exphbs.engine);
app.set('view engine', 'handlebars');

// Disable view caching in development for live reloading
if (process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'development') {
    app.set('view cache', false);
}

app.use(express.static(path.join(__dirname, 'public')));

// Add routes
app.use('/', require('./routes/home').default);
app.use('/account', require('./routes/account').default);
app.use('/service', require('./routes/service').default);

//Prod SSL Stuff
if (process.env.NODE_ENV === 'production') {
    app.use(function (req, res, next) {
        console.log( req.headers.host );
        if (req.headers.host === DOMAIN_WITHOUT_WWW) {
            res.redirect(302, `https://${DOMAIN_NAME}` + req.originalUrl);
        } else {
            next();
        }
    });
}

// Middleware to log session events with enhanced metadata
app.use((req, res, next) => {
    if (!req.session) {
        return next();
    }

    // Cast session to any to add custom properties
    const session = req.session as any;
    const user = req.user as any;

    // Only log if this is a new session or user authentication event
    const shouldLog = !session.logged || user !== session.lastUser;
    
    if (shouldLog) {
        // Determine event type
        let eventType = 'Session Activity';
        if (!session.logged) {
            eventType = 'Session Creation';
            session.logged = true;
        } else if (user && user !== session.lastUser) {
            eventType = user ? 'User Login' : 'User Logout';
        }
        
        // Track last user state
        session.lastUser = user;
        
        // Log session event with comprehensive metadata
        try {
            logSession(eventType, req, {
                sessionAge: req.session.cookie.maxAge,
                cookieSecure: req.session.cookie.secure,
                isNewSession: !session.logged,
                userRole: user?.role || null,
                userEmail: user?.email || null
            });
        } catch (err) {
            console.error('Failed to log session event:', err);
        }
    }
    
    next();
});

// Middleware to log important route access
app.use((req, res, next) => {
    const user = req.user as any;
    const importantRoutes = [
        '/service/new-instance',
        '/service/terminate-instance',
        '/service/admin',
        '/account/login',
        '/account/logout',
        '/account/register'
    ];
    
    const isImportantRoute = importantRoutes.some(route => 
        req.originalUrl.startsWith(route)
    );
    
    if (isImportantRoute || (req.method !== 'GET' && req.method !== 'HEAD')) {
        try {
            logSession('Route Access', req, {
                route: req.originalUrl,
                method: req.method,
                userRole: user?.role || 'anonymous',
                statusCode: res.statusCode,
                bodySize: req.headers['content-length'] || null
            });
        } catch (err) {
            console.error('Failed to log route access:', err);
        }
    }
    
    next();
});

// catch 404 and forward to error handler
app.use(function(req, res ) {
    appLogger.warn('404 Not Found', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'],
        timestamp: new Date().toISOString()
    });
    res.json({"error":{code:404,status:"not found"}});
});

// Start the server
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    appLogger.info('Server started successfully', {
        port: PORT,
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
    
    // Detect and log the public URL
    try {
        const { detectServiceUrl } = await import('./utility/detectServiceUrl');
        const urlInfo = await detectServiceUrl();
        
        console.log('═══════════════════════════════════════════════════');
        console.log(`✓ Server URL detected: ${urlInfo.url}`);
        console.log(`  Source: ${urlInfo.source}`);
        console.log(`  Hostname: ${urlInfo.hostname}`);
        console.log(`  Protocol: ${urlInfo.protocol}`);
        console.log('═══════════════════════════════════════════════════');
        
        appLogger.info('Service URL detected', {
            url: urlInfo.url,
            source: urlInfo.source,
            hostname: urlInfo.hostname,
            protocol: urlInfo.protocol,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        appLogger.warn('Failed to detect service URL', {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        });
    }
});

// Note: WebSocket proxying is now handled by Kubernetes Ingress (not at app level)

export default app;