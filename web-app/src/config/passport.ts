import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import { PassportStatic } from 'passport';
import db from '../models';
import configAuth from './auth';
import emailRelay from '../utility/emailRelay';
import helperFunctions from '../utility/helperFunctions';

export default (passport: PassportStatic) => {
    passport.use(db.User.createStrategy());
    passport.use(new LocalStrategy(db.User.authenticate()));

    passport.serializeUser((user: any, done: (err: any, id?: any) => void) => {
        done(null, user.email);
    });
    
    passport.deserializeUser((email: string, done: (err: any, user?: any) => void) => {
        db.User.findOne({ where: { email: email } }).then((user: any | null) => {
            done(null, user);
        }).catch(done);
    });
    
    passport.use(new GoogleStrategy(configAuth.googleAuth, 
        (accessToken: string, refreshToken: string, profile: any, done: (err: any, user?: any) => void) => {
            const _email = profile.emails[0].value || '';

            db.User.findOne({ where: { oauthID: profile.id } })
            .then((user: any | null) => {
                if (user) {
                    // If the user with the oauthID exists, return the user
                    return done(null, user);
                } else {
                    // If no user with the oauthID exists, look for a user with the same email
                    db.User.findOne({ where: { email: _email } })
                    .then((existingUser: any | null) => {
                        if (existingUser) {
                            // Update the existing user with the oauthID
                            existingUser.oauthID = profile.id;
                            existingUser.save().then((updatedUser: any) => {
                                return done(null, updatedUser);
                            }).catch((err: any) => {
                                return done(err);
                            });
                        } else {
                            // If no user with the same email exists, create a new user
                            const newUser = db.User.build({
                                username: helperFunctions.sanitizeUsername(profile.displayName),
                                email: _email,
                                oauthID: profile.id,
                                role: helperFunctions.updateRoleIfAdmin(_email)
                            });
                            newUser.save().then((savedUser: any) => {
                                return done(null, savedUser);
                            }).catch((err: any) => {
                                return done(err);
                            });
                        }
                    }).catch((err: any) => {
                        return done(err);
                    });
                }
            }).catch((err: any) => {
                return done(err);
            });
        }
    ));
};