const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();
const { Op } = require('sequelize');

const authenticate = require('../utility/authenticate');
const database = require('../utility/db.js');

const mailer = require("../utility/email-relay.js");

var passport = require('passport');
var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');

const { sanitizeUsername } = require('../utility/helperFunctions.js');

router.get('/', (req,res) => {
    if (req.user) {
        const alertSuccess = req.flash('alert-success');
        res.render('user_account_edit', {
            // csrfToken: req.csrfToken(),
            user: req.user,
            alertSuccess: alertSuccess
        });
    } else {
        res.redirect('/account/login');
    }
});

router.get('/register', (req, res) => {
    res.render('user_account_register');
});

router.post('/register', (req, res) => {
    database.User.register(new database.User({
        username: sanitizeUsername(req.body.username),
        role: "user",
        email: req.body.email,
        oauthProvider: "vipercloud",
        created: Date.now()
    }), req.body.password, (err, user) => {
        if (err) {
            var tmpErrMsg = "There was a problem creating your account. Please try again or contact our team who can assist.";
            res.format({
                html: () => {
                    console.log("sign up err: " + err.parent.errno);
                    if (err.parent.errno == 1062) {
                        tmpErrMsg = "We are sorry but that email or username is already taken. If this is your account try resetting your password. Or use the social login.";
                    } else if ( err.errors && err.errors[0].message ) {
                        tmpErrMsg = err.errors[0].message;
                    }
                    res.render('user_account_register', {
                        error_message: tmpErrMsg,
                        page_title: 'register a new ViPER Cloud account',
                        loggedin: 0
                    });
                },
                //JSON response will show the newly created blob
                json: () => {
                    res.json(responseData);
                }
            });
        } else {
            mailer.sendWelcomeEmail(req.body.email);
            req.flash('alert-success', 'Thanks for setting up a ViPER account - you may need to contact an admin to get full access to the services on offer.');
            req.login(user, (err) => {
                if (!err) {
                    res.redirect('/account');
                } else {
                    res.json(err);
                }
            });
        }
    });
});

router.get('/login', (req, res) => {
    //Force log out? redirect if already logged in?
    const errorMsg = req.flash('error');
    res.render('user_account_login', { error_message: errorMsg });
});


router.post('/login', passport.authenticate('local', { failureRedirect: '/account/login', failureFlash: true }),
    (req, res) => {
        if (req.user) {
            res.redirect('/account');
        } else {
            console.log("Login failed... redirecting....");
            res.redirect('/account/login');
        }
});

router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/account/login')
    });
});

//Google oAuth routes
router.get('/login/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/return', passport.authenticate('google', { failureRedirect: '/account/login', failureFlash: true }),  (req, res) => {
    req.flash('alert-success', 'Thanks for setting up a ViPER account - you may need to contact an admin to get full access to the services on offer.');
    res.redirect('/account');
});

module.exports = router;