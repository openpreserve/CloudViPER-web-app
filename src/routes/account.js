const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();
const { Op } = require('sequelize');

const authenticate = require('../utility/authenticate');
const database = require('../utility/db.js');

const mailer = require("../utility/emailRelay.js");

var passport = require('passport');
var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');

const { sanitizeUsername } = require('../utility/helperFunctions.js');
const emailRelay = require('../utility/emailRelay.js');

router.get('/', (req,res) => {
    if (req.user) {
        const alertSuccess = req.flash('alert-success');
        //console.log( JSON.stringify(req.user) );

        res.render('user_account_edit', {
            // csrfToken: req.csrfToken(),
            user: req.user.toJSON(),
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
            console.log(err);
            res.status(500).json({ message: 'Error creating user.' });
        } else {
            mailer.sendWelcomeEmail(req.body.email,sanitizeUsername(req.body.username));
            req.flash('alert-success', 'Thanks for setting up a ViPER account - you may need to contact an admin to get full access to the services on offer.');
            // res.redirect('/account');
            //console.log( JSON.stringify(user) );
            req.login(user, (err) => {
                if (err) {
                    console.log(err);
                    res.status(500).json({ message: 'Error logging in user.' });
                } else {
                    res.redirect('/account');
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

router.get('/reset-password',
function (req, res) {
    res.render('user_account/forgot_password');
})

router.post('/reset-password', (req, res) => {
    const { email } = req.body;
    const token = crypto.randomBytes(20).toString('hex');

    database.User.findOne({ where: { email } }).then(user => {
        if (!user) {
            // return res.status(400).json({ message: 'No account with that email address exists.' });
            // For security reasons, don't return information that leaks info about the service and users...
            return res.render('user_account_post_reset_password');
        }
        
        user.update({
            resetPasswordToken: token,
            resetPasswordExpires: Date.now() + 3600000,
        }).then(() => {
            text = `You are receiving this message because you have requested the reset of the password for your account.\n\n
                Please click on the following link, or paste this into your browser to complete the process:\n\n
                https://www.vipercloud.cc/account/reset-token/${token}\n\n
                If you did not request this, please ignore this email and your password will remain unchanged.\n`

            emailRelay.sendResetEmail(email, text);
            res.render('user_account_post_reset_password');

        }).catch(err => {
            console.log("Error updating user: ", err);
            // res.status(500).json({ message: 'Error updating user.' });
            res.render('user_account_post_reset_password');
        });
    }).catch(err => {
        console.log("Error finding user: ", err);
        // res.status(500).json({ message: 'Error finding user.' });
        res.render('user_account_post_reset_password');
    });
});

router.get('/reset-token/:token', (req, res) => {
    database.User.findOne({ where: { resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } } }).then(user => {
        if (!user) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }
        res.render('user_account_get_reset_token');
    });
});

router.post('/reset-token/:token', (req, res) => {
    database.User.findOne({ where: { resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } } }).then(user => {
        if (!user) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }
        user.setPassword(req.body.password, (err, updatedUser) => {
            if (err) {
                console.log("Error setting new password: ", err);
                return res.status(500).json({ message: 'Error setting new password.' });
            }
            updatedUser.resetPasswordToken = null; // Clear the reset token
            updatedUser.save().then(() => {
                // res.status(200).json({ message: 'Password has been updated.' });
                res.render('user_account_post_reset_token');
            }).catch(saveErr => {
                console.log("Error saving user: ", saveErr);
                res.status(500).json({ message: 'Error saving user.' });
            });
        });
    }).catch(err => {
        console.log("Error finding user by token: ", err);
        res.status(500).json({ message: 'Error finding user.' });
    });
});



module.exports = router;