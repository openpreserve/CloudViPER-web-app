import express, { Application } from 'express';
import exphbs from './config/handlebars';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
// import expressSession from 'express-session';

// import MySQLStore from 'express-mysql-session';
import passport from 'passport';
import flash from 'connect-flash';

import configAuth from './config/auth';

dotenv.config({ path: "./.env" });

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);
const secure_cookie = (process.env.NODE_ENV === 'production') ? true || false : false;

// Begin server setup
app.use( bodyParser.urlencoded({ extended: true}) );
let path = require('path');
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Prod specific 
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next)=>{
        //force https
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(302, ['https://vipercloud.cc', req.url].join('')); 
        }
        next();
    });
}

// Sessions
import session from 'express-session'
const MySQLStore = require('express-mysql-session')(session);
const SQLStore = new MySQLStore(configAuth.mysqlSessionAuth);
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
app.use(express.static(path.join(__dirname, 'public')));

// Add routes
app.use('/', require('./routes/home').default);
app.use('/account', require('./routes/account').default);
app.use('/service', require('./routes/service').default);

//Prod SSL Stuff
if (process.env.NODE_ENV === 'production') {
    app.use(function (req, res, next) {
        console.log( req.headers.host );
        if (req.headers.host === 'vipercloud.cc') {
            res.redirect(302, 'https://www.vipercloud.cc' + req.originalUrl);
        } else {
            next();
        }
    });
}

// catch 404 and forward to error handler
app.use(function(req, res ) {
    res.json({"error":{code:404,status:"not found"}});
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});