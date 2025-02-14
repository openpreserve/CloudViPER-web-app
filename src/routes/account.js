const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();
const { Op } = require('sequelize');

const authenticate = require('../utility/authenticate');
const database = require('../utility/db.js');
const mysql = require('mysql2');

const mailer = require("../utility/emailRelay.js");

var passport = require('passport');
var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');

const { sanitizeUsername, generateUsername, generateRandomString } = require('../utility/helperFunctions.js');
const emailRelay = require('../utility/emailRelay.js');
var configAuth = require('../config/auth');
// const { dfareporting } = require('googleapis/build/src/apis/dfareporting/index.js');

router.use(express.json()); // parse json

/*
ROLES:

user - nothing
testing - can run one viper
member - can run one viper
subscriber - pays for use
admin - viper and user management

*/

router.get('/', (req, res) => {
    if (req.user) {
        const alertSuccess = req.flash('alert-success');
        //console.log( JSON.stringify(req.user) );

        switch (req.user.role) {
            case 'admin':
                res.redirect('/service/admin');
                break;
            case 'testing':
                res.redirect('/service/testing');
                break;
            case 'member':
                res.redirect('/service/member');
                break;

            default:
                res.render('user_account_index', {
                    // csrfToken: req.csrfToken(),
                    user: req.user.toJSON(),
                    alertSuccess: alertSuccess
                });
        }

    } else {
        res.redirect('/account/login');
    }
});

router.post('/update', (req, res) => {
    const _action = req.body.action;
    const _userid = req.body.userid;

    if (req.user && (req.user.role == 'admin' || req.user.id == req.body.userid)) {
        switch (_action) {
            case 'get':
                database.User.findOne({ where: { id: _userid } }).then(user => {
                    if (!user) {
                        return res.status(400).json({ message: 'Not found.' });
                    }
                }).catch(err => {
                    console.log("Error finding user by id: ", _userid);
                    res.status(500).json({ message: 'Error finding user.' });
                });

                break;

            default:
                res.json(req.user);//send back the actuall user, like get
        }
    } else {
        res.status(403);
    }
});

router.get('/users', (req, res) => {
    if (req.user && req.user.role == 'admin') {
        database.User.findAll().then((users) => {
            // Remove 'salt' and 'hash' from each user
            const safeUsers = users.map(user => {
                const { salt, hash, ...safeUser } = user.toJSON(); // Use toJSON() to get a plain object
                return safeUser;
            });

            res.json(safeUsers);
        }).catch((error)=>{
            res.status(500).json({ error: error });
        });
    } else {
        res.status(403).send({message:"Error 3"});
    }
});

router.put('/users/:id/role', (req, res) => {
    if (req.user && req.user.role == 'admin') {
        const userId = req.params.id;
        const newRole = req.body.role;

        console.error(req.body);
        console.error(`${userId} - ${newRole}`);

        database.User.update({ role: newRole }, { where: { id: userId } })
        .then(() => res.status(200).send({ message: 'Role updated successfully' }))
        .catch(error => res.status(500).send({ message: 'Error updating role', error }));
    }else{
        res.status(403).send({ message: 'Error updating role' });
    }
});

router.post('/users/invite', (req, res) => {
    if (req.user && req.user.role == 'admin') {
        database.User.register(new database.User({
            username: generateUsername(req.body.email),
            role: req.body.role,
            email: req.body.email,
            oauthProvider: "vipercloud",
            created: Date.now()
        }), generateRandomString(25)/*password*/ , (err, user) => {
            if (err) {
                console.log(err);
                res.status(500).json({ message: 'Error creating user.' });
            } else {
                mailer.sendInvitedEmail(req.body.email, generateUsername(req.body.email), req.user.username);
                res.status(200).json({ message: 'New user invited', user: user.id });
            }
        });
    } else {
        res.status(403).send({message:"Error 33"});
    }
});

router.get('/sessions', (req, res) => {
    if (req.user && req.user.role == 'admin') {
        const connection = mysql.createConnection(configAuth.mysqlSessionAuth);
        const query = 'SELECT session_id, expires, data FROM sessions';

        connection.query(query, (error, results) => {
          if (error) {
            console.error('Error retrieving sessions:', error);
            return res.status(500).send({ message: 'Error retrieving sessions', error });
          }
      
          const safeSessions = results.map(session => {
            const sessionData = JSON.parse(session.data);
           const expiresAt = new Date(sessionData.cookie.expires); 
           const isExpired = Date.now() > expiresAt; 
           let sessionUsername = 'unknown';
           if (sessionData.passport && sessionData.passport.user){
            sessionUsername = sessionData.passport.user;
           }

           return{
              id: session.session_id,
              username: sessionUsername,
              loginTime: new Date(sessionData.cookie.expires).toLocaleString(),
              expiresAt: expiresAt.toLocaleString(), 
              status: isExpired ? 'active' : 'expired',
            };
          });
      
          res.json(safeSessions);
        });   
    } else {
        res.status(403).send({ message: 'Error 2' });
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
            mailer.sendWelcomeEmail(req.body.email, sanitizeUsername(req.body.username));
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

router.get('/google/return', passport.authenticate('google', { failureRedirect: '/account/login', failureFlash: true }), (req, res) => {
    req.flash('alert-success', 'Thanks for setting up a ViPER account - you may need to contact an admin to get full access to the services on offer.');
    res.redirect('/account');
});

router.get('/reset-password',
    function (req, res) {
        res.render('user_account_get_reset_password');
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


            emailRelay.sendResetEmail(email, user.username, token);
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
    const _token = req.params.token;
    database.User.findOne({ where: { resetPasswordToken: _token, resetPasswordExpires: { [Op.gt]: Date.now() } } }).then(user => {
        if (!user) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }
        res.render('user_account_get_reset_token',
            {
                token: _token,
            }
        );
    });
});

router.post('/reset-token', (req, res) => {
    const _token = req.body.token;

    database.User.findOne({ where: { resetPasswordToken: _token, resetPasswordExpires: { [Op.gt]: Date.now() } } }).then(user => {
        if (!user) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }
        user.setPassword(req.body.password, (err, updatedUser) => {
            if (err) {
                console.log("Error setting new password: ", err);
                return res.status(500).json({ message: 'Error setting new password.' });
            }
            updatedUser.resetPasswordToken = null; // Clear the reset token
            updatedUser.resetPasswordExpires = null; // Clear the reset token
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