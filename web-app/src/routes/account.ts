import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { Op } from 'sequelize';
import db from '../models/';
import mysql from 'mysql2';
import passport from 'passport';
import crypto from 'crypto';
import helperFunctions from '../utility/helperFunctions';
import emailRelay, { EmailRelay } from '../utility/emailRelay';
import configAuth from '../config/auth';
import { appLogger } from '../config/logger';
import { UserRole, isValidRole, toUserRole } from '../types/UserRole';

dotenv.config();

const router = express.Router();

router.use(express.json()); // parse json

/*
ROLES:

user - nothing
testing - can run one viper
member - can run one viper
subscriber - pays for use
admin - viper and user management

Note: These roles are now defined as an enum in ../types/UserRole.ts
*/

function userAsJSON(user: any): object {
    try{
        return {
            id: user.id,
            username: user.username,
            role: user.role
        };
    } catch (err) {
        console.error("Error converting user to JSON: ", err);
        return {};
    }
}
interface AccountUser {
    id: number;
    username: string;
    role: UserRole;
}

interface SafeUser {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    // Add other properties as needed
}

router.get('/', (req: Request, res: Response) => {
    const user = req.user as AccountUser | undefined;
    if (user) {
        const alertSuccess = req.flash('alert-success');
        //console.log( JSON.stringify(user) );

        switch (user.role) {
            case UserRole.ADMIN:
                res.redirect('/service/admin');
                break;
            case UserRole.TESTING:
                res.redirect('/service/testing');
                break;
            case UserRole.MEMBER:
                res.redirect('/service/member');
                break;

            default:
                res.render('user_account_index', {
                    // csrfToken: req.csrfToken(),
                    user: req.user ? userAsJSON( req.user ) : {},
                    alertSuccess: alertSuccess
                });
        }

    } else {
        res.redirect('/account/login');
    }
});

router.post('/update', (req: Request, res: Response) => {
    const _action = req.body.action;
    const _userid = req.body.userid;

    const user = req.user as AccountUser | undefined;

    if (user && (user.role == UserRole.ADMIN || user.id == _userid)) {
        switch (_action) {
            case 'get':
                interface FindUserResponse {
                    message?: string;
                    user?: AccountUser;
                }

                db.User.findOne({ where: { id: _userid } }).then((user: any | null) => {
                    if (!user) {
                        const response: FindUserResponse = { message: 'Not found.' };
                        res.status(400).json(response);
                        return;
                    }
                    res.json(user);
                }).catch((err: Error) => {
                    console.log("Error finding user by id: ", _userid);
                    const response: FindUserResponse = { message: 'Error finding user.' };
                    res.status(500).json(response);
                });

                break;

            default:
                res.json(req.user); // send back the actual user, like get
        }
    } else {
        res.status(403).json({ message: 'Unauthorized.' });
    }
});

router.get('/users', (req: Request, res: Response) => {
    const user = req.user as AccountUser | undefined;

    if (user && user.role == UserRole.ADMIN) {
        db.User.findAll().then((users: any[]) => {
            // // Remove 'salt' and 'hash' from each user
            // const safeUsers: SafeUser[] = users.map(user => {
            //     const { salt, hash, ...safeUser } = userAsJSON(user) as any; // Use toJSON() to get a plain object
            //     return safeUser as SafeUser;
            // });

            // res.json(safeUsers);

            res.json(users);
        }).catch((error: Error) => {
            res.status(500).json({ error: error.message });
        });
    } else {
        res.status(403).send({ message: "Error 3" });
    }
});

router.put('/users/:id/role', async (req: Request, res: Response): Promise<void> => {
    const currentUser = req.user as AccountUser;
    if (currentUser && currentUser.role == UserRole.ADMIN) {
        const userId = req.params.id;
        const newRole = req.body.role;

        // Validate the new role
        if (!isValidRole(newRole)) {
            res.status(400).send({ 
                message: 'Invalid role', 
                validRoles: Object.values(UserRole) 
            });
            return;
        }

        try {
            // Get the target user's current role for logging
            const targetUser = await db.User.findByPk(userId);
            const oldRole = targetUser?.role;

            console.error(req.body);
            console.error(`${userId} - ${newRole}`);

            await db.User.update({ role: newRole }, { where: { id: userId } });
            
            // Log the role change
            appLogger.info('User role changed', {
                eventType: 'Role Change',
                targetUserId: parseInt(userId),
                targetUserEmail: targetUser?.email,
                targetUsername: targetUser?.username,
                oldRole,
                newRole,
                adminUserId: currentUser.id,
                adminUsername: currentUser.username,
                timestamp: new Date().toISOString()
            });

            res.status(200).send({ message: 'Role updated successfully' });
        } catch (error) {
            appLogger.error('Role change failed', {
                eventType: 'Role Change Error',
                targetUserId: parseInt(userId),
                newRole,
                adminUserId: currentUser.id,
                error: (error as Error).message,
                timestamp: new Date().toISOString()
            });
            res.status(500).send({ message: 'Error updating role', error });
        }
    } else {
        res.status(403).send({ message: 'Error updating role' });
    }
});

router.post('/users/invite', async (req: Request, res: Response): Promise<void> => {
    const currentUser = req.user as AccountUser;
    if (currentUser && currentUser.role == UserRole.ADMIN) {   
        // Validate the role before processing
        const assignedRole = toUserRole(req.body.role);
        
        try {
            const newUsername = helperFunctions.generateUsername(req.body.email);
            
            const user = await db.User.register({
                username: newUsername,
                role: assignedRole,
                email: req.body.email,
                oauthProvider: "vipercloud",
                // created: Date.now()
            }, helperFunctions.generateRandomString(25)/*password*/);
            
            // Log successful user invitation
            appLogger.info('User invited successfully', {
                eventType: 'User Invitation',
                newUserId: user.id,
                newUserEmail: req.body.email,
                newUsername,
                assignedRole: assignedRole,
                invitedByUserId: currentUser.id,
                invitedByUsername: currentUser.username,
                timestamp: new Date().toISOString()
            });
            
            try {
                await emailRelay.sendInvitedEmail(req.body.email, newUsername, currentUser.username);
                
                // Log successful email sending
                appLogger.info('Invitation email sent', {
                    eventType: 'Invitation Email',
                    recipientEmail: req.body.email,
                    recipientUsername: newUsername,
                    invitedByUsername: currentUser.username,
                    timestamp: new Date().toISOString()
                });
            } catch (emailError) {
                console.error('Error sending invitation email:', emailError);
                
                // Log email failure
                appLogger.error('Invitation email failed', {
                    eventType: 'Invitation Email Error',
                    recipientEmail: req.body.email,
                    recipientUsername: newUsername,
                    invitedByUsername: currentUser.username,
                    error: (emailError as Error).message,
                    timestamp: new Date().toISOString()
                });
                // Continue execution - user was created successfully even if email failed
            }
            
            res.status(200).send({ message: 'User invited successfully', user });
        } catch (err: any) {
            // Log invitation failure
            appLogger.error('User invitation failed', {
                eventType: 'User Invitation Error',
                targetEmail: req.body.email,
                targetRole: assignedRole,
                invitedByUserId: currentUser.id,
                invitedByUsername: currentUser.username,
                error: err.message,
                timestamp: new Date().toISOString()
            });
            
            res.status(500).send({ message: 'Error inviting user', err });
        }
    } else {
        res.status(403).send({ message: 'Unauthorized' });
    }
});

router.get('/sessions', (req: Request, res: Response) => {
    if (req.user && (req.user as AccountUser).role == UserRole.ADMIN) {
        const connection = mysql.createConnection(configAuth.mysqlSessionAuth);
        const query = 'SELECT session_id, expires, data FROM sessions';

        connection.query(query, (error, results: mysql.RowDataPacket[]) => {
          if (error) {
            console.error('Error retrieving sessions:', error);
            return res.status(500).send({ message: 'Error retrieving sessions', error });
          }
      
          const safeSessions = results.map(session => {
            const sessionData = JSON.parse(session.data);
            const expiresAt = new Date(sessionData.cookie.expires); 
            const isExpired = Date.now() > expiresAt.getTime(); 
            let sessionUsername = 'unknown';
            if (sessionData.passport && sessionData.passport.user){
              sessionUsername = sessionData.passport.user;
            }

            return {
              id: session.session_id,
              username: sessionUsername,
              loginTime: new Date(sessionData.cookie.expires).toLocaleString(),
              expiresAt: expiresAt.toLocaleString(), 
              status: isExpired ? 'expired' : 'active',
            };
          });
      
          res.json(safeSessions);
        });   
    } else {
        res.status(403).send({ message: 'Error 2' });
    }
});

// Removed the routes for register and register post
// These routes are disabled during the Testing Phase of the app development

// router.get('/register', (req: Request, res: Response) => {
//     res.render('user_account_register');
// });

// router.post('/register', (req: Request, res: Response) => {
//     db.User.register({
//         username: helperFunctions.sanitizeUsername(req.body.username),
//         role: "user",
//         email: req.body.email,
//         oauthProvider: "vipercloud",
//         // createdAt: Date.now()
//     }, req.body.password).then((user: User) => {
//         emailRelay.sendWelcomeEmail(req.body.email, helperFunctions.sanitizeUsername(req.body.username));
//         req.flash('alert-success', 'Thanks for setting up a ViPER account - you may need to contact an admin to get full access to the services on offer.');
//         req.login(user, (err: Error) => {
//             if (err) {
//                 console.log(err);
//                 res.status(500).json({ message: 'Error logging in user.' });
//             } else {
//                 res.redirect('/account');
//             }
//         });

//     }).catch((err: Error) => {
//         console.log(err);
//         res.status(500).json({ message: 'Error creating user.' });
//     });
// });


router.get('/login', (req: Request, res: Response) => {
    //Force log out? redirect if already logged in?
    const errorMsg = req.flash('error');
    res.render('user_account_login', { error_message: errorMsg });
});


router.post('/login', passport.authenticate('local', { failureRedirect: '/account/login', failureFlash: true }),
    (req, res) => {
        if (req.user) {
            const user = req.user as AccountUser;
            
            // Log successful login
            appLogger.info('User logged in successfully', {
                eventType: 'User Login',
                userId: user.id,
                username: user.username,
                userRole: user.role,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date().toISOString()
            });
            
            res.redirect('/account');
        } else {
            console.log("Login failed... redirecting....");
            
            // Log failed login attempt
            appLogger.warn('Login attempt failed', {
                eventType: 'Login Failure',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date().toISOString()
            });
            
            res.redirect('/account/login');
        }
    });

router.get('/logout', (req: Request, res: Response) => {
    const user = req.user as AccountUser;
    
    req.logout((err) => {
        if (err) {
            appLogger.error('Logout error', {
                eventType: 'Logout Error',
                userId: user?.id,
                username: user?.username,
                error: err.message,
                timestamp: new Date().toISOString()
            });
            res.json(err);
        } else {
            // Log successful logout
            appLogger.info('User logged out', {
                eventType: 'User Logout',
                userId: user?.id,
                username: user?.username,
                userRole: user?.role,
                ipAddress: req.ip,
                timestamp: new Date().toISOString()
            });
        }
        res.redirect('/account/login')
    });
});

//Google oAuth routes
router.get('/login/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/return', passport.authenticate('google', { failureRedirect: '/account/login', failureFlash: true }), (req, res) => {
    const user = req.user as AccountUser;
    
    // Log successful Google OAuth login
    appLogger.info('User logged in via Google OAuth', {
        eventType: 'Google OAuth Login',
        userId: user.id,
        username: user.username,
        userRole: user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
    });
    
    req.flash('alert-success', 'Thanks for setting up a ViPER account - you may need to contact an admin to get full access to the services on offer.');
    res.redirect('/account');
});

router.get('/reset-password',
    function (req: Request, res: Response) {
        res.render('user_account_get_reset_password');
    })

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    const plainToken = crypto.randomBytes(32).toString('hex'); // Generate random token
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex'); // Hash for storage
    const expiryTime = new Date(Date.now() + 3600000); // 1 hour from now
    
    console.log(`🔐 Password reset request for: ${email}`);
    console.log(`🔗 Reset URL: http://localhost:3000/account/reset-token/${plainToken}`);

    // Log password reset request
    appLogger.info('Password reset requested', {
        eventType: 'Password Reset Request',
        email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
    });

    try {
        const user = await db.User.findOne({ where: { email } });
        if (!user) {
            console.log(`❌ No user found with email: ${email}`);
            
            // Log failed reset attempt (user not found)
            appLogger.warn('Password reset request for non-existent user', {
                eventType: 'Password Reset - User Not Found',
                email,
                ipAddress: req.ip,
                timestamp: new Date().toISOString()
            });
            
            // For security reasons, don't return information that leaks info about the service and users...
            res.render('user_account_post_reset_password');
            return;
        }

        console.log(`✅ User found: ${user.username} (ID: ${user.id})`);

        try {
            await user.update({
                resetPasswordToken: hashedToken, // Store hashed token
                resetPasswordExpires: expiryTime,
            });
            
            console.log(`✅ Reset token generated and stored for ${user.username}`);
            
            // Log successful token generation
            appLogger.info('Password reset token generated', {
                eventType: 'Password Reset Token Generated',
                userId: user.id,
                username: user.username,
                email,
                tokenExpiry: expiryTime.toISOString(),
                timestamp: new Date().toISOString()
            });
            
            try {
                await emailRelay.sendResetEmail(email, user.username, plainToken); // Send plain token via email
                console.log(`📧 Reset email sent to: ${email}`);
                
                // Log successful email sending
                appLogger.info('Password reset email sent', {
                    eventType: 'Password Reset Email Sent',
                    userId: user.id,
                    username: user.username,
                    email,
                    timestamp: new Date().toISOString()
                });
            } catch (emailError) {
                console.error('❌ Error sending reset email:', emailError);
                
                // Log email failure
                appLogger.error('Password reset email failed', {
                    eventType: 'Password Reset Email Error',
                    userId: user.id,
                    username: user.username,
                    email,
                    error: (emailError as Error).message,
                    timestamp: new Date().toISOString()
                });
                // Continue execution - token was stored successfully even if email failed
            }
            
            res.render('user_account_post_reset_password');
        } catch (err) {
            console.log("❌ Error updating user: ", err);
            
            // Log database error
            appLogger.error('Password reset token storage failed', {
                eventType: 'Password Reset Error',
                userId: user.id,
                username: user.username,
                email,
                error: (err as Error).message,
                timestamp: new Date().toISOString()
            });
            
            res.render('user_account_post_reset_password');
        }
    } catch (err) {
        console.log("❌ Error finding user: ", err);
        
        // Log database error
        appLogger.error('Password reset user lookup failed', {
            eventType: 'Password Reset Database Error',
            email,
            error: (err as Error).message,
            timestamp: new Date().toISOString()
        });
        
        res.render('user_account_post_reset_password');
    }
});

router.get('/reset-token/:token', (req: Request, res: Response) => {
    const plainToken = req.params.token;
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex'); // Hash the token for database lookup
    const currentTime = new Date();
    
    console.log(`🔍 Token validation attempt: ${plainToken.substring(0, 8)}...`);
    
    interface ResetTokenResponse {
        message?: string;
    }

    db.User.findOne({ 
        where: { 
            resetPasswordToken: hashedToken, 
            resetPasswordExpires: { [Op.gt]: Date.now() } 
        } 
    }).then((user: any | null) => {
        if (!user) {
            console.log(`❌ Invalid or expired token: ${plainToken.substring(0, 8)}...`);
            
            const response: ResetTokenResponse = { message: 'Password reset token is invalid or has expired.' };
            res.status(400).json(response);
            return;
        }
        
        console.log(`✅ Valid token for user: ${user.username}`);
        
        res.render('user_account_get_reset_token', {
            token: plainToken, // Pass plain token to form for submission
        });
    }).catch((err: Error) => {
        console.log("❌ Error validating token: ", err);
        const response: ResetTokenResponse = { message: 'Error finding user.' };
        res.status(500).json(response);
    });
});

router.post('/reset-token', async (req: Request, res: Response): Promise<void> => {
    const plainToken = req.body.token;
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex'); // Hash submitted token to compare
    
    console.log(`🔐 Password reset submission for token: ${plainToken.substring(0, 8)}...`);
    
    interface ResetTokenResponse {
        message?: string;
    }

    try {
        const user = await db.User.findOne({ 
            where: { 
                resetPasswordToken: hashedToken, 
                resetPasswordExpires: { [Op.gt]: Date.now() } 
            } 
        });
        
        if (!user) {
            console.log(`❌ Invalid token for password reset: ${plainToken.substring(0, 8)}...`);
            const response: ResetTokenResponse = { message: 'Password reset token is invalid or has expired.' };
            res.status(400).json(response);
            return;
        }

        console.log(`✅ Valid token, updating password for: ${user.username}`);

        try {
            await user.setPassword(req.body.password);
            user.resetPasswordToken = undefined; // Clear the reset token
            user.resetPasswordExpires = undefined; // Clear the expiration
            await user.save();

            console.log(`✅ Password updated successfully for: ${user.username}`);

            // Log the user in
            req.login(user, (err: Error) => {
                if (err) {
                    console.log("❌ Error logging in user after password reset: ", err);
                    const response: ResetTokenResponse = { message: 'Error logging in user.' };
                    res.status(500).json(response);
                    return;
                }
                console.log(`✅ User ${user.username} logged in after password reset`);
                res.redirect('/account');
            });
        } catch (err) {
            console.log("❌ Error setting new password: ", err);
            const response: ResetTokenResponse = { message: 'Error setting new password.' };
            res.status(500).json(response);
            return;
        }
    } catch (err) {
        console.log("❌ Error during password reset: ", err);
        const response: ResetTokenResponse = { message: 'Error finding user.' };
        res.status(500).json(response);
    }
});

router.get('/debug-tokens', async (req: Request, res: Response) => {
    // Debug endpoint to check tokens in database
    if (req.user && (req.user as AccountUser).role == UserRole.ADMIN) {
        try {
            const users = await db.User.findAll({
                attributes: ['id', 'username', 'email', 'resetPasswordToken', 'resetPasswordExpires']
            });
            
            // Filter for users with tokens
            const usersWithTokens = users.filter(user => user.resetPasswordToken);
            
            const now = new Date();
            const debugInfo = usersWithTokens.map(user => {
                const isExpired = user.resetPasswordExpires ? new Date(user.resetPasswordExpires) < now : true;
                const timeRemaining = user.resetPasswordExpires ? 
                    Math.round((new Date(user.resetPasswordExpires).getTime() - now.getTime()) / 1000 / 60) : 0;
                
                return {
                    username: user.username,
                    email: user.email,
                    tokenLength: user.resetPasswordToken ? user.resetPasswordToken.length : 0,
                    tokenPreview: user.resetPasswordToken ? user.resetPasswordToken.substring(0, 16) + '...' : 'null',
                    tokenType: user.resetPasswordToken && user.resetPasswordToken.length === 64 ? 'HASHED (SHA256)' : 'UNKNOWN',
                    expires: user.resetPasswordExpires,
                    isExpired: isExpired,
                    timeUntilExpiry: timeRemaining > 0 ? `${timeRemaining} minutes` : 'EXPIRED'
                };
            });
            
            console.log('=== DEBUG TOKENS ENDPOINT ===');
            console.log(`Found ${usersWithTokens.length} users with reset tokens`);
            
            res.json({
                currentTime: now,
                tokensFound: usersWithTokens.length,
                tokens: debugInfo,
                note: "SHA256 hashes should be 64 characters long"
            });
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    } else {
        res.status(403).json({ message: 'Admin access required' });
    }
});

export default router;