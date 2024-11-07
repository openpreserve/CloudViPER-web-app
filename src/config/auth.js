// config/auth.js

module.exports = {
    'googleAuth':
    {
        clientID: process.env.GOOGLE_AUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
        callbackURL: "https://www.vipercloud.cc/account/google/return/",
    },
};