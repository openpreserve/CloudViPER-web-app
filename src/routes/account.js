const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();
const { Op } = require('sequelize');

const authenticate = require('../utility/authenticate');
const database = require('../utility/db.js');

const gmail = require("../utility/email-relay.js")

var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');

// //prevent brute force attacks? Look at this:
// var ExpressBrute = require('express-brute');

// function usernameToLowerCase(req, res, next) {
//     req.body.username = req.body.username.toLowerCase();
//     next();
// }

router.get('/', (req,res)=>{
    if (req.user) {
        res.render('user_account_edit', {
            // csrfToken: req.csrfToken(),
            user: req.user
        });
    } else {
        res.redirect('/account/login');
    }
});

//TODO: Update the html view.... but thats a given for the whole HTML version
router.get('/register', function (req, res) {
    // req.logout();//should prob logout?
    res.render('user_account_register');
});

router.post('/register', 
// bruteforce.prevent, 
function (req, res) {
    database.User.register(new database.User({
        username: req.body.username,
        nickname: req.body.username,
        role: "user",
        email: req.body.email,
        oauthProvider: "vipercloud",
        created: Date.now()
    }), req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            //return res.render('register', { account : account });
            var responseData = {};
            responseData["registered"] = 0;
            responseData["message"] = "You are not registered";
            responseData["error"] = err.code; //the error objects has a lot of info
            responseData["data"] = {};
            var tmpErrMsg = "There was a problem creating your account. Please try again or contact our team who can assist.";
            res.format({
                html: function () {
                    console.log("sign up err: " + err.code);
                    if (err.code == 11000) {
                        tmpErrMsg = "We are sorry but that email or username is already taken. If this is your account try resetting your password. Or use the social login.";
                    } else if (err.message) {
                        tmpErrMsg = err.message;
                    }
                    res.render('user_account_register', {
                        error_message: tmpErrMsg,
                        page_title: 'register a new ViPER Cloud account',
                        loggedin: 0
                    });
                },
                //JSON response will show the newly created blob
                json: function () {
                    res.json(responseData);
                }
            });
        } else {
            gmail.sendWelcomeEmail(req.body.email);

            var responseData = {};
            responseData["registered"] = 1;
            responseData["message"] = "You are registered";
            responseData["error"] = "";
            responseData["data"] = {};

            req.login(user, function (err) {
                if (!err) {
                    res.redirect('/account');
                } else {
                    res.json(err);
                }
            });



        }
    });
});

router.get('/login', function (req, res) {
    //Force log out? redirect if already logged in?
    res.render('user_account_login');
});


module.exports = router;