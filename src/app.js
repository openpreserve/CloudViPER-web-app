const express = require('express');
const exphbs = require("./config/handlebars.js");
const dotenv = require('dotenv').config();
const bodyParser = require('body-parser');
const expressSession = require('express-session');
const MemoryStore = require('memorystore')(expressSession);
const passport = require('passport');
const flash = require('connect-flash');

const app = express();



const PORT = process.env.PORT || 3000;

// Begin server setup
app.use( bodyParser.urlencoded({ extended: true}) );
var path = require('path');
app.disable('x-powered-by');
app.set('trust proxy', 1);

//  sessions
var session_config = {
    name:"vipercloud.sid",
    cookie: { maxAge: ((4 * 24) * 60 * 60 * 1000) }, // 4 days
    store: new MemoryStore({ checkPeriod: 86400000 }), // prune expired entries every 24h
    secret: process.env.APP_COOKIE_SECRET, // Replace with your own secret key
    resave: false,
    saveUninitialized: false,
}
// Prod specific 
if (process.env.NODE_ENV === 'production') {
    session_config.cookie.secure = true;
    app.use((req, res, next)=>{
        //force https
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(302, ['https://vipercloud.cc', req.url].join('')); 
        }
        next();
    });
}

// Add session to app
const sessionMW = expressSession(session_config);
app.use(sessionMW);
app.use(flash());

// Configure passport
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport.js')(passport);


// View Engine
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', exphbs.engine);
app.set('view engine', 'handlebars');
app.use(express.static(path.join(__dirname, 'public')));

// Add routes
app.use('/', require('./routes/home'));
app.use('/account', require('./routes/account'));
app.use('/service', require('./routes/service'));

if (process.env.NODE_ENV === 'production') {
    app.use(function (req, res, next) {
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