var GoogleStrategy = require('passport-google-oauth20').Strategy;
var LocalStrategy = require('passport-local').Strategy;

// var LocalAccount = require('../models/localaccount');
const database = require('../utility/db.js');

// load the auth variables
var configAuth = require('./auth');
var mailer = require('../utility/emailRelay.js');
const { sanitizeUsername, updateRoleIfAdmin } = require('../utility/helperFunctions.js');


module.exports = (passport) => {
    passport.use(database.User.createStrategy());
    passport.use(new LocalStrategy(database.User.authenticate()));

    passport.serializeUser((user, done) => {
        done(null, user.oauthID);
    });
    
    passport.deserializeUser((id, done) => {
        database.User.findOne({ where: { oauthID: id } }).then((user) => {
            done(null, user);
        }).catch(done);
    });
    
    passport.use(new GoogleStrategy(configAuth.googleAuth, 
        (accessToken, refreshToken, profile, done) => {
            const _email = profile.emails[0].value || '';
        
            // First, find a user with the provided oauthID
            database.User.findOne({ where: { oauthID: profile.id } })
            .then(user => {
                if (user) {
                    // If the user with the oauthID exists, return the user
                    return done(null, user);
                } else {
                    // If no user with the oauthID exists, look for a user with the same email
                    database.User.findOne({ where: { email: _email } })
                    .then(existingUser => {
                        if (existingUser) {
                            // Update the existing user with Google profile info
                            existingUser.update({
                                oauthID: profile.id,
                                oauthProvider: 'google',
                                profile_pic: profile.photos[0].value,
                                oauthProfile: profile
                            }).then(updatedUser => {
                                return done(null, updatedUser);
                            }).catch(err => {
                                console.log("GooglePassport update err: ", err);
                                return done(null, false, { message: err.message });
                            });
                        } else {
                            // Create a new user with the Google profile info
                            database.User.create({
                                oauthID: profile.id,
                                email: _email,
                                name: profile.displayName,
                                username: sanitizeUsername(profile.displayName),
                                oauthProvider: 'google',
                                profile_pic: profile.photos[0].value,
                                role: updateRoleIfAdmin(_email),
                                created: Date.now()
                            }).then(newUser => {
                                mailer.sendWelcomeEmail(_email);
                                return done(null, newUser);
                            }).catch(err => {
                                console.log("GooglePassport create err: ", err);
                                return done(null, false, { message: err.message });
                            });
                        }
                    }).catch(err => {
                        console.log("GooglePassport find by email err: ", err);
                        return done(err);
                    });
                }
            }).catch(err => {
                console.log("GooglePassport find by oauthID err: ", err);
                return done(err);
            });
        }));

}; //module exports