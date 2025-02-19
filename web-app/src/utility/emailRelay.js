// utility/email-relay.js

const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const _footer =  '<h3>&nbsp;-&nbsp;ViPER Cloud team</h3><div style="font-size: 12px; color: grey; text-align: center; padding: 10px;">This is an unmanaged email account, and as a result cannot recieve messages, do not reply to this message. If you need help and support, please reach out to <strong>sysadmin@openpreservation.org</strong></div>';

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
            _footer
        }).then(() => {
          console.log('Email sent')
        })
        .catch((error) => {
          console.error(error)
        });
    },
    sendInvitedEmail : function(in_email, in_username, in_invitee){
      sgMail.send({
          to: in_email, 
          from: 'no-reply@vipercloud.cc',
          subject: 'Welcome to ViPER Cloud '+in_username,
          text: 'You have been invited to the ViPER Cloud community by '+in_invitee
          +'. Your username is "'+in_username+'" and the email used to sign you up was "'
          +in_email+'". To begin using the service you will need to reset your password by visiting the following link, and following the instructions: https://www.vipercloud.cc/account/reset-password',
          
          html: '<h2>You have been invited to use ViPER Cloud!</h2>'+
          'You have been invited by '+in_invitee
          +'. Your username is "'+in_username+'" and the email used to sign you up was "'
          +in_email+'". To begin using the service you will need to reset your password by visiting the following link, and following the instructions:'+
          '<h3>Reset ViPER Cloud password: <a href="https://www.vipercloud.cc/account/reset-password">https://www.vipercloud.cc/account/reset-password</a>.</h3><br>\n\n'+      
          'Access ViPER Cloud via <a href="https://www.vipercloud.cc">www.vipercloud.cc</a>.<br>\n\n'+
          'You may need to await a service admin to authorise your account to access the advanced features of the service.<br>\n\n'+
          'Find out more information about ViPER here <a href="https://viper.openpreservation.org">https://viper.openpreservation.org</a>.<br>\n\n'+
          _footer
      }).then(() => {
        console.log('Email sent')
      })
      .catch((error) => {
        console.error(error)
      });
    },
    sendResetEmail : function(in_email, in_username, in_token){
      sgMail.send({
          to: in_email, 
          from: 'no-reply@vipercloud.cc',
          subject: 'ViPER Cloud - Password reset',
          text: `You are receiving this message because you have requested the reset of the password for your account.\n\n
          USERNAME: ${in_username}\n\n
          EMAIL: ${in_email}\n\n
          Please click on the following link, or paste this into your browser to complete the process:\n\n
          https://www.vipercloud.cc/account/reset-token/${in_token}\n\n
          If you did not request this, please ignore this email and your password will remain unchanged.\n`,
          html: '<h2>A ViPER Cloud password reset was requested</h2>'+
          'You are receiving this message because you have requested the reset of the password for your account.<br>\n\n'+
          '<p>USERNAME: '+in_username+'<br>\n\n'+
          'EMAIL: '+in_email+'</p><br>\n\n'+
          'Please click on the following link, or paste this into your browser to complete the process:<br>\n\n'+
          '<p><a href="https://www.vipercloud.cc/account/reset-token/'+in_token+'">https://www.vipercloud.cc/account/reset-token/'+in_token+'</a></p><br>\n\n'+
          'Your email was requested to initiate this password reset, but please use the USERNAME to log into the service<br>\n\n'+
          'If you did not request this, please ignore this email and your password will remain unchanged.<br>\n\n'+
          _footer
      }).then(() => {
        console.log('Email sent')
      })
      .catch((error) => {
        console.error(error)
      });
  },
};