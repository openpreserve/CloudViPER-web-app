// config/auth.js

const auth = {
    'googleAuth':
    {
        clientID: process.env.GOOGLE_AUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
        callbackURL: "https://www.vipercloud.cc/account/google/return/",
    },

    'mysqlSessionAuth':
    {   
        host: process.env.DB_HOST, 
        port: 3306, 
        user: process.env.DB_USER, 
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    },
};

export default auth;