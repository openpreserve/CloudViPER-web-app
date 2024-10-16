// utility/email-relay.js

const auth = require("../config/auth")

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: auth.googleMailRelayAuth
});

module.exports = {
    sendWelcomeEmail : function(in_email){
        transporter.sendMail({
            from: '"Darren" <darren@openpreservation.org>',
            to: in_email,
            subject: 'ViPER via OPF Sysadmin: Welcome to ViPER Cloud',
            html: '<h2>You are now part of the ViPER community</h2>'+
            'Access ViPER Cloud via <a href="https://www.vipercloud.cc">www.vipercloud.cc</a>.<br>\n\n'+
            'You may need to await a service admin to authorise your account to access the advanced features of the service.<br>\n\n'+
            'Find out more information about ViPER here <a href="https://viper.openpreservation.org">www.vipercloud.cc</a>.<br>\n\n'+
            '<h3>&nbsp;-&nbsp;ViPER Cloud team</h3>'
        }, (error, info) => {
            if (error) {
                console.log('Email error: ', error);
                return console.error('Error: ', error);
            }
            console.log('Email sent: ', info);
        });
    },
};