import { MailerSend, EmailParams, Recipient, Sender } from "mailersend";
import { Resend } from 'resend';
import { appLogger } from '../config/logger';

// Get domain name from environment variable
const DOMAIN_NAME = process.env.DOMAIN_NAME || 'cloudviper.org';
const DOMAIN_WITHOUT_WWW = DOMAIN_NAME.replace(/^www\./, '');

// Email provider selection (mailersend or resend)
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'mailersend';
const EMAIL_SEND_DOMAIN = process.env.EMAIL_SEND_DOMAIN || DOMAIN_WITHOUT_WWW;

/**
 * Interface defining the email relay service methods
 */
interface EmailRelay {
  /**
   * Sends a welcome email to a new user
   * @param email - User's email address
   * @param username - User's username
   */
  sendWelcomeEmail: (email: string, username: string) => Promise<void>;
  
  /**
   * Sends an invitation email to a user invited by another user
   * @param email - User's email address
   * @param username - User's username
   * @param invitee - Username of the person who sent the invitation
   */
  sendInvitedEmail: (email: string, username: string, invitee: string) => Promise<void>;
  
  /**
   * Sends a password reset email with a secure token
   * @param email - User's email address
   * @param username - User's username
   * @param token - Secure reset token
   */
  sendResetEmail: (email: string, username: string, token: string) => Promise<void>;
}

const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY!,
});

const resend = new Resend(process.env.RESEND_API_KEY || '');

const _footer =  '<h3>&nbsp;-&nbsp;CloudViPER team</h3><div style="font-size: 12px; color: grey; text-align: center; padding: 10px;">This is an unmanaged email account, and as a result cannot receive messages; do not reply to this message. If you need help and support, please reach out to <strong>sysadmin@openpreservation.org</strong></div>';

const emailRelay: EmailRelay = {
    sendWelcomeEmail: async (in_email: string, in_username: string): Promise<void> => {
        if (EMAIL_PROVIDER === 'resend') {
            // Resend implementation
            try {
                appLogger.info('Attempting to send welcome email via Resend', {
                    recipient: in_email,
                    username: in_username,
                    from: `no-reply@${EMAIL_SEND_DOMAIN}`
                });

                const response = await resend.emails.send({
                    from: `CloudViPER <no-reply@${EMAIL_SEND_DOMAIN}>`,
                    to: [in_email],
                    subject: 'Welcome to CloudViPER ' + in_username,
                    html: '<h2>You are now part of the Viper community</h2>' +
                        `Access CloudViPER via <a href="https://${DOMAIN_NAME}">${DOMAIN_NAME}</a>.<br>\n\n` +
                        'You may need to wait for a service admin to authorize your account to access the advanced features of the service.<br>\n\n' +
                        'Find out more information about ViPER here <a href="https://viper.openpreservation.org">https://viper.openpreservation.org</a>.<br>\n\n' +
                        _footer,
                });

                appLogger.info('Welcome email sent successfully via Resend', {
                    recipient: in_email,
                    username: in_username,
                    response: JSON.stringify(response)
                });
            } catch (error: any) {
                appLogger.error('Failed to send welcome email via Resend', {
                    recipient: in_email,
                    username: in_username,
                    error: error.message,
                    errorDetails: JSON.stringify(error)
                });
                throw error;
            }
        } else {
            // MailerSend implementation
            const sentFrom = new Sender(`no-reply@${DOMAIN_WITHOUT_WWW}`, "CloudViPER");
            const recipients = [new Recipient(in_email, in_username)];

            const emailParams = new EmailParams()
                .setFrom(sentFrom)
                .setTo(recipients)
                .setSubject('Welcome to CloudViPER ' + in_username)
                .setText(`You are now part of the Viper community. Access CloudViPER via https://${DOMAIN_NAME}/`)
                .setHtml('<h2>You are now part of the Viper community</h2>' +
                    `Access CloudViPER via <a href="https://${DOMAIN_NAME}">${DOMAIN_NAME}</a>.<br>\n\n` +
                    'You may need to wait for a service admin to authorize your account to access the advanced features of the service.<br>\n\n' +
                    'Find out more information about ViPER here <a href="https://viper.openpreservation.org">https://viper.openpreservation.org</a>.<br>\n\n' +
                    _footer);

            try {
                appLogger.info('Attempting to send welcome email via MailerSend', {
                    recipient: in_email,
                    username: in_username,
                    from: `no-reply@${DOMAIN_WITHOUT_WWW}`
                });
                
                const response = await mailerSend.email.send(emailParams);
                
                appLogger.info('Welcome email sent successfully via MailerSend', {
                    recipient: in_email,
                    username: in_username,
                    response: JSON.stringify(response),
                    statusCode: response?.statusCode,
                    body: response?.body
                });
            } catch (error: any) {
                appLogger.error('Failed to send welcome email via MailerSend', {
                    recipient: in_email,
                    username: in_username,
                    error: error.message,
                    errorDetails: JSON.stringify(error),
                    statusCode: error?.response?.status,
                    responseData: error?.response?.data
                });
                throw error;
            }
        }
    },
    sendInvitedEmail: async (in_email: string, in_username: string, in_invitee: string): Promise<void> => {
        if (EMAIL_PROVIDER === 'resend') {
            // Resend implementation
            try {
                appLogger.info('Attempting to send invitation email via Resend', {
                    recipient: in_email,
                    username: in_username,
                    invitedBy: in_invitee,
                    from: `no-reply@${EMAIL_SEND_DOMAIN}`
                });

                const response = await resend.emails.send({
                    from: `CloudViPER <no-reply@${EMAIL_SEND_DOMAIN}>`,
                    to: [in_email],
                    subject: 'Welcome to CloudViPER ' + in_username,
                    html: '<h2>You have been invited to use CloudViPER!</h2>' +
                        'You have been invited by ' + in_invitee +
                        '. Your username is "' + in_username + '" and the email used to sign you up was "' +
                        in_email + '". To begin using the service you will need to reset your password by visiting the following link, and following the instructions:' +
                        `<h3>Reset CloudViPER password: <a href="https://${DOMAIN_NAME}/account/reset-password">https://${DOMAIN_NAME}/account/reset-password</a>.</h3><br>\n\n` +
                        `Access CloudViPER via <a href="https://${DOMAIN_NAME}">${DOMAIN_NAME}</a>.<br>\n\n` +
                        'You may need to wait for a service admin to authorize your account to access the advanced features of the service.<br>\n\n' +
                        'Find out more information about ViPER here <a href="https://viper.openpreservation.org">https://viper.openpreservation.org</a>.<br>\n\n' +
                        _footer,
                });

                appLogger.info('Invitation email sent successfully via Resend', {
                    recipient: in_email,
                    username: in_username,
                    invitedBy: in_invitee,
                    response: JSON.stringify(response)
                });
            } catch (error: any) {
                appLogger.error('Failed to send invitation email via Resend', {
                    recipient: in_email,
                    username: in_username,
                    invitedBy: in_invitee,
                    error: error.message,
                    errorDetails: JSON.stringify(error)
                });
                throw error;
            }
        } else {
            // MailerSend implementation
            const sentFrom = new Sender(`no-reply@${DOMAIN_WITHOUT_WWW}`, "CloudViPER");
            const recipients = [new Recipient(in_email, in_username)];

            const emailParams = new EmailParams()
                .setFrom(sentFrom)
                .setTo(recipients)
                .setSubject('Welcome to CloudViPER ' + in_username)
                .setText('You have been invited to the CloudViPER community by ' + in_invitee +
                    '. Your username is "' + in_username + '" and the email used to sign you up was "' +
                    in_email + `". To begin using the service you will need to reset your password by visiting the following link, and following the instructions: https://${DOMAIN_NAME}/account/reset-password`)
                .setHtml('<h2>You have been invited to use CloudViPER!</h2>' +
                    'You have been invited by ' + in_invitee +
                    '. Your username is "' + in_username + '" and the email used to sign you up was "' +
                    in_email + '". To begin using the service you will need to reset your password by visiting the following link, and following the instructions:' +
                    `<h3>Reset CloudViPER password: <a href="https://${DOMAIN_NAME}/account/reset-password">https://${DOMAIN_NAME}/account/reset-password</a>.</h3><br>\n\n` +
                    `Access CloudViPER via <a href="https://${DOMAIN_NAME}">${DOMAIN_NAME}</a>.<br>\n\n` +
                    'You may need to wait for a service admin to authorize your account to access the advanced features of the service.<br>\n\n' +
                    'Find out more information about ViPER here <a href="https://viper.openpreservation.org">https://viper.openpreservation.org</a>.<br>\n\n' +
                    _footer);

            try {
                appLogger.info('Attempting to send invitation email via MailerSend', {
                    recipient: in_email,
                    username: in_username,
                    invitedBy: in_invitee,
                    from: `no-reply@${DOMAIN_WITHOUT_WWW}`
                });
                
                const response = await mailerSend.email.send(emailParams);
                
                appLogger.info('Invitation email sent successfully via MailerSend', {
                    recipient: in_email,
                    username: in_username,
                    invitedBy: in_invitee,
                    response: JSON.stringify(response),
                    statusCode: response?.statusCode,
                    body: response?.body
                });
            } catch (error: any) {
                appLogger.error('Failed to send invitation email via MailerSend', {
                    recipient: in_email,
                    username: in_username,
                    invitedBy: in_invitee,
                    error: error.message,
                    errorDetails: JSON.stringify(error),
                    statusCode: error?.response?.status,
                    responseData: error?.response?.data
                });
                throw error;
            }
        }
    },
    sendResetEmail: async (in_email: string, in_username: string, in_token: string): Promise<void> => {
        if (EMAIL_PROVIDER === 'resend') {
            // Resend implementation
            try {
                appLogger.info('Attempting to send password reset email via Resend', {
                    recipient: in_email,
                    username: in_username,
                    from: `no-reply@${EMAIL_SEND_DOMAIN}`
                });

                const response = await resend.emails.send({
                    from: `CloudViPER <no-reply@${EMAIL_SEND_DOMAIN}>`,
                    to: [in_email],
                    subject: 'CloudViPER - Password reset',
                    html: '<h2>A CloudViPER password reset was requested</h2>' +
                        'You are receiving this message because you have requested the reset of the password for your account.<br>\n\n' +
                        '<p>USERNAME: ' + in_username + '<br>\n\n' +
                        'EMAIL: ' + in_email + '</p><br>\n\n' +
                        'Please click on the following link, or paste this into your browser to complete the process:<br>\n\n' +
                        `<p><a href="https://${DOMAIN_NAME}/account/reset-token/${in_token}">https://${DOMAIN_NAME}/account/reset-token/${in_token}</a></p><br>\n\n` +
                        'If you did not request this, please ignore this email and your password will remain unchanged.<br>\n\n' +
                        _footer,
                });

                appLogger.info('Password reset email sent successfully via Resend', {
                    recipient: in_email,
                    username: in_username,
                    response: JSON.stringify(response)
                });
            } catch (error: any) {
                appLogger.error('Failed to send password reset email via Resend', {
                    recipient: in_email,
                    username: in_username,
                    error: error.message,
                    errorDetails: JSON.stringify(error)
                });
                throw error;
            }
        } else {
            // MailerSend implementation
            const sentFrom = new Sender(`no-reply@${DOMAIN_WITHOUT_WWW}`, "CloudViPER");
            const recipients = [new Recipient(in_email, in_username)];

            const emailParams = new EmailParams()
                .setFrom(sentFrom)
                .setTo(recipients)
                .setSubject('CloudViPER - Password reset')
                .setText(`You are receiving this message because you have requested the reset of the password for your account.\n\n
          USERNAME: ${in_username}\n\n
          EMAIL: ${in_email}\n\n
          Please click on the following link, or paste this into your browser to complete the process:\n\n
          https://${DOMAIN_NAME}/account/reset-token/${in_token}\n\n
          If you did not request this, please ignore this email and your password will remain unchanged.\n`)
                .setHtml('<h2>A CloudViPER password reset was requested</h2>' +
                    'You are receiving this message because you have requested the reset of the password for your account.<br>\n\n' +
                    '<p>USERNAME: ' + in_username + '<br>\n\n' +
                    'EMAIL: ' + in_email + '</p><br>\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:<br>\n\n' +
                    `<p><a href="https://${DOMAIN_NAME}/account/reset-token/${in_token}">https://${DOMAIN_NAME}/account/reset-token/${in_token}</a></p><br>\n\n` +
                    'If you did not request this, please ignore this email and your password will remain unchanged.<br>\n\n' +
                    _footer);

            try {
                appLogger.info('Attempting to send password reset email via MailerSend', {
                    recipient: in_email,
                    username: in_username,
                    from: `no-reply@${DOMAIN_WITHOUT_WWW}`
                });
                
                const response = await mailerSend.email.send(emailParams);
                
                appLogger.info('Password reset email sent successfully via MailerSend', {
                    recipient: in_email,
                    username: in_username,
                    response: JSON.stringify(response),
                    statusCode: response?.statusCode,
                    body: response?.body
                });
            } catch (error: any) {
                appLogger.error('Failed to send password reset email via MailerSend', {
                    recipient: in_email,
                    username: in_username,
                    error: error.message,
                    errorDetails: JSON.stringify(error),
                    statusCode: error?.response?.status,
                    responseData: error?.response?.data
                });
                throw error;
            }
        }
    },
};

export type { EmailRelay };
export default emailRelay;