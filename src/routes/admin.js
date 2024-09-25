const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();
const { Op } = require('sequelize');



const expressSession = require('express-session');
const MemoryStore = require('memorystore')(expressSession);

const sessionMW = expressSession({
    store: new MemoryStore({ checkPeriod: 86400000 }), // prune expired entries every 24h
    secret: process.env.APP_COOKIE_SECRET, // Replace with your own secret key
    resave: false,
    saveUninitialized: false,
});

router.use(sessionMW);
router.use( bodyParser.urlencoded({ extended: true}) );
const authenticate = require('../utility/authenticate');
const database = require('../utility/db.js');

function endOfDay(dateString) {
    const date = new Date(dateString);
    date.setHours(23, 59, 59, 999); // Set to the last millisecond of the day
    return date;
}

/* GET home page. */
router.get('/', authenticate, (req, res)=>{
    res.render('admin_index', {
        page_title: "ViPER Admin Portal",
        form_h1: "Admin Portal",
        form_p: "Search and tools", 
      });
});

router.get('/new-instance', (req, res)=>{
    res.json({});
});

// router.get('/all', async (req,res)=>{
//     const data = await database.NPS.findAll();
//     res.json(data);
// });

router.get('/login', (req,res)=>{
    res.render('login', {
        page_title: "Admin Login",
        form_h1: "Please Login to access content....",
        form_p: "", 
      });
});
router.post('/login', (req,res)=>{
    const admin_username = process.env.APP_USERNAME;
    const admin_password = process.env.APP_PASSWORD;

    if(admin_username==req.body.username && admin_password==req.body.password){
        req.session.is_admin = true;
        let redirectUrl = '/admin';
        if(req.cookies && req.cookies.redirect_url != undefined){
            redirectUrl = req.cookies.redirect_url;
        }
        
        res.clearCookie('redirect_url'); // Clear the cookie
        res.redirect(redirectUrl);
    }else{
        req.session.is_admin = false;
        res.status(401).redirect('/admin/login');
    }
});


module.exports = router;