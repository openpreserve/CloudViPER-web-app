// config/auth.js

module.exports = {
    'googleAuth' : 
    {
        clientID: "ID.apps.googleusercontent.com",
        clientSecret: "secret",
        callbackURL: "https://www.vipercloud.cc/account/google/return"
    },
    'googleMailRelayAuth' : 
    {
        type: 'OAuth2',
        clientId: process.env.GOOGLE_MAIL_CLIENTID,
        clientSecret: process.env.GOOGLE_MAIL_CLIENT_SECRET,
    }
};