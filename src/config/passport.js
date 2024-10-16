var GoogleStrategy = require('passport-google-oauth20').Strategy;
var LocalStrategy = require('passport-local').Strategy;

// var LocalAccount = require('../models/localaccount');
const database = require('../utility/db.js');

// load the auth variables
var configAuth = require('./auth');
var gmail = require('../utility/email-relay.js');

module.exports = function(passport) {

    passport.use(database.User.createStrategy());
    passport.serializeUser(database.User.serializeUser());
    passport.deserializeUser(database.User.deserializeUser());

//   //passport google
//   passport.use(new GoogleStrategy(configAuth.googleAuth,
//     function(accessToken, refreshToken, profile, cb) {
//       //console.log(JSON.stringify( profile ));
//       LocalAccount.findOne({oauthID: profile.id}, function (err, user) {
//         if(err) {
//           console.log("GooglePassport find err: "+err);  // handle errors!
//         }
//         if (!err && user !== null) {
//           return cb(null, user);
//         } else {
//           var _email="";
//           try {
//               _email = profile.emails[0].value;
//           } catch (ex) {
//             console.log(ex);
//           }
//           console.log('oauthID: '+ profile.id);
//           user = new LocalAccount({
//             oauthID : ""+profile.id,
//             username : ""+profile.id,
//             email : _email,
//             name : profile.displayName,
//             nickname : profile.displayName,
//             oauthProvider: "google",
//             profile_pic: _pic,
//             oauthProfile : profile,
//             role:"user",
//             created : Date.now()          
//           });
//           user.save(function(err) {
//             if(err) {
//               console.log("GooglePassport save err: "+err);  // handle errors!
//               if(err.code == 11000){
//                   tmpErrMsg = "We are sorry but that email address is already taken. Perhaps you have an account already? Try logging in or creating a new account. Alternatively contact us and we will see what we can do.";
//               }else if(err.message){
//                   tmpErrMsg = err.message;
//               }
//               return cb(null, false, { message: tmpErrMsg });
//             } else {
//               console.log("saving GOOGLE user ...");
//               gmail.sendWelcomeEmail(_email);
//               return cb(null, user);
//             }
//           });
//         }
//         //return done(error, user);
//       });
//     }
//   ));
  

}; //module exports