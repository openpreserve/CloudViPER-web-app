// utility/email-relay.js

const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

module.exports = {
    sendWelcomeEmail : function(in_email, in_username){
        sgMail.send({
            to: in_email, 
            from: 'no-reply@vipercloud.cc',
            subject: 'Welcome to ViPER Cloud '+in_username,
            text: 'You are now part of the ViPER community. Access ViPER Cloud via https://www.vipercloud.cc/',
            html: '<h2>You are now part of the ViPER community</h2>'+
            'Access ViPER Cloud via <a href="https://www.vipercloud.cc">www.vipercloud.cc</a>.<br>\n\n'+
            'You may need to await a service admin to authorise your account to access the advanced features of the service.<br>\n\n'+
            'Find out more information about ViPER here <a href="https://viper.openpreservation.org">https://viper.openpreservation.org</a>.<br>\n\n'+
            '<h3>&nbsp;-&nbsp;ViPER Cloud team</h3>'+
            '<div style="font-size: 12px; color: grey; text-align: center; padding: 10px;">This is an unmanaged email account, and as a result cannot recieve messages, do not reply to this message. If you need help and support, please reach out to <strong>sysadmin@openpreservation.org</strong></div>',
        }).then(() => {
          console.log('Email sent')
        })
        .catch((error) => {
          console.error(error)
        });
    },
    sendResetEmail : function(in_email, in_text){
      sgMail.send({
          to: in_email, 
          from: 'no-reply@vipercloud.cc',
          subject: 'ViPER Cloud - Password reset',
          text: in_text,
      }).then(() => {
        console.log('Email sent')
      })
      .catch((error) => {
        console.error(error)
      });
  },
};