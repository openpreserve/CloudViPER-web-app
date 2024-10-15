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

var passport = require('passport');

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
    req.logout();//should prob logout?
    res.render('user_account/register', {
        page_title: 'register a new yourstuff account',
        page_description: "Create a new account. You can use your Google or Facebook account, or create a new one. After you create an account you can message other user and service providers, and make purchases.",
        page_path: req.path,
        page_type: "website",
        page_image: "https://www.yourstuff.store/images/large_box_logo2.png",
        nav_image: 'yourstuff_box.svg',
        // flash_message:req.flash('flash_message') ,
        loggedin: 0
    });

    //     res.render('index', { 
    // 		page_title: 'yourstuff',
    // 		page_description: "yourstuff.store home page. Here is where all the stuff is!", 
    // 		page_path: req.path, 
    // 		page_type:"website",
    // 		page_image: "https://yourstuff.store/images/large_box_logo2.png",
    //     // flash_message:req.flash('flash_message') ,
    //     loggedin: (req.user) ? 1 : 0
    // });
});


router.post('/register', 
// bruteforce.prevent, 
function (req, res) {
    // req.logout();//should prob logout?
    LocalAccount.register(new LocalAccount({
        username: req.body.username,
        nickname: req.body.username,
        role: "user",
        email: req.body.email,
        name: req.body.name,
        surname: req.body.surname,
        oauthProvider: "yourstuff",
        terms: constants.termsAndConditions.string,
        terms_version: constants.termsAndConditions.version,
        profile_pic: "https://imagecache.yourstuff.store/avatar.php?size=150&hash=" + crypto.createHash('md5').update("" + req.body.username + "stuff" + req.body.email).digest('hex'),
        created: Date.now()
    }), req.body.password, function (err, user) {
        if (err) {
            //return res.render('register', { account : account });
            var responseData = {};
            responseData["registered"] = 0;
            responseData["message"] = "You are not registered";
            responseData["error"] = err.code; //the error objects has a lot of info about the existing user ////:::
            // responseData["error"] = err;
            //responseData["error"].op="";
            responseData["data"] = {};
            var tmpErrMsg = "There was a probem creating your account. Please try again or contact our team who can assist.";
            res.format({
                html: function () {
                    console.log("sign up err: " + err.code);
                    if (err.code == 11000) {
                        //tmpErrMsg = "We are sorry but that email address is already taken. If this is your account try resetting your password instead.";
                        tmpErrMsg = "We are sorry but that email or username is already taken. If this is your account try resetting your password. Or use the social login.";
                    } else if (err.message) {
                        tmpErrMsg = err.message;
                    }
                    //res.redirect("/");//send you home?
                    //req.flash('signupMessage', tmpErrMsg);
                    res.render('user_account/register', {
                        error_message: tmpErrMsg, /*JSON.stringify(err)*/
                        page_title: 'register a new yourstuff account',
                        page_description: "yourstuff.store account registration. Here is where all the stuff is!",
                        page_path: req.path,
                        page_type: "website",
                        page_image: "https://www.yourstuff.store/images/large_box_logo2.png",
                        nav_image: 'yourstuff_box.svg',
                        // flash_message:req.flash('flash_message') ,
                        loggedin: 0
                    });
                },
                //JSON response will show the newly created blob
                json: function () {
                    res.json(responseData);
                }
            });
        } else {
            sendgridEmail.sendWelcomeEmail(req.body.email);

            var responseData = {};
            responseData["registered"] = 1;
            responseData["message"] = "You are registered";
            responseData["error"] = "";
            responseData["data"] = {};

            req.login(user, function (err) {
                if (!err) {
                    //lets see if we can send the user back to where they came from
                    if (req.session.redirectTo && req.session.redirectTo != "") {
                        var tmp_redirect = req.session.redirectTo;
                        req.session.redirectTo = "";
                        if (tmp_redirect != '/account/login') {
                            console.log('Redirect 1');
                            req.flash('alert-success', 'Thanks for setting up a yourstuff account - you can see your account details by clicking the icon in the top right of the screen.');
                            res.redirect(tmp_redirect);
                        } else {
                            console.log('Redirect 2');
                            req.flash('alert-success', 'Thanks for setting up a yourstuff account - here you can update your personal details, create new posts, and see the activities you have under way.');
                            res.redirect('/account');
                        }
                    } else {
                        res.format({
                            html: function () {
                                //TODO: could haver a welcoming flash message here?
                                req.flash('alert-success', 'Thanks for setting up a yourstuff account - here you can update your personal details, create new posts, and see the activities you have under way.');
                                res.redirect("/account");//send you home?
                            },
                            //JSON response will show the newly created blob
                            json: function () {
                                res.json(responseData);
                            }
                        });
                    }
                } else {
                    //handle error
                    req.flash('error', 'Problem logging into your new account? Try logging in again or contacting us for help.');
                    res.redirect("/");
                }
            });



        }
    });
});


module.exports = router;