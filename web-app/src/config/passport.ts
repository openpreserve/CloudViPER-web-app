import express, { Request, Response } from 'express';
import { Strategy as GoogleStrategy, StrategyOptionsWithRequest, Profile, VerifyCallback } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import { PassportStatic } from 'passport';
import database from '../utility/db';
import DatabaseUser from '../models/user';
import configAuth from './auth';
import emailRelay from '../utility/emailRelay';
import helperFunctions from '../utility/helperFunctions';

export default (passport: PassportStatic) => {
    passport.use(DatabaseUser.createStrategy());
    // passport.use(new LocalStrategy(DatabaseUser.authenticate()));

    passport.serializeUser((user: any, done: (err: any, id?: any) => void) => {
        done(null, user.email);
    });
    
    passport.deserializeUser((email: string, done: (err: any, user?: any) => void) => {
        // interface User {
        //     email: string;
        //     oauthID?: string;
        //     username?: string;
        //     role?: string;
        //     save: () => Promise<User>;
        // }

        // interface DoneFunction {
        //     (err: any, user?: User | null): void;
        // }

        DatabaseUser.findOne({ where: { email: email } }).then((user: DatabaseUser | null) => {
            done(null, user);
        }).catch(done);
    });

    const googleStrategyOptions: StrategyOptionsWithRequest = {
            clientID: configAuth.googleAuth.clientID || '',
            clientSecret: configAuth.googleAuth.clientSecret || '',
            callbackURL: configAuth.googleAuth.callbackURL,
            passReqToCallback: true
    };  

    passport.use( new GoogleStrategy(googleStrategyOptions,
        async (req: Request, accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
            if (!profile.emails || profile.emails.length === 0) {
                return done(new Error('No email found in profile'), false);
            }

            const _email = profile.emails[0].value || '';
            // interface User {
            //     email: string;
            //     oauthID?: string;
            //     username?: string;
            //     role?: string;
            //     save: () => Promise<User>;
            // }

            // interface Profile {
            //     id: string;
            //     displayName: string;
            //     emails: { value: string }[];
            // }

            // interface DoneFunction {
            //     (err: any, user?: User | null): void;
            // }

            DatabaseUser.findOne({ where: { oauthID: profile.id } })
            .then((user: DatabaseUser | null) => {
                if (user) {
                    // If the user with the oauthID exists, return the user
                    return done(null, user);
                } else {
                    // If no user with the oauthID exists, look for a user with the same email
                    DatabaseUser.findOne({ where: { email: _email } })
                    .then((existingUser: DatabaseUser | null) => {
                        if (existingUser) {
                            // Update the existing user with the oauthID
                            existingUser.oauthID = profile.id;
                            existingUser.save().then((updatedUser: DatabaseUser) => {
                                return done(null, updatedUser);
                            }).catch((err: any) => {
                                return done(err);
                            });
                        } else {
                            // If no user with the same email exists, create a new user
                            const newUser = DatabaseUser.build({
                                username: helperFunctions.sanitizeUsername(profile.displayName),
                                email: _email,
                                oauthID: profile.id,
                                role: helperFunctions.updateRoleIfAdmin(_email)
                            });
                            newUser.save().then((savedUser: DatabaseUser) => {
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
        })
    );
};
    