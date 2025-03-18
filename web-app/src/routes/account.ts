import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { Op } from 'sequelize';
import db from '../models/';
import mysql from 'mysql2';
import passport from 'passport';
import crypto from 'crypto';
import helperFunctions from '../utility/helperFunctions';
import emailRelay from '../utility/emailRelay';
import configAuth from '../config/auth';

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
interface User {
    id: number;
    username: string;
    role: string;
}

interface SafeUser {
    id: number;
    username: string;
    email: string;
    role: string;
    // Add other properties as needed
}

router.get('/', (req: Request, res: Response) => {
    const user = req.user as User | undefined;
    if (user) {
        const alertSuccess = req.flash('alert-success');
        //console.log( JSON.stringify(user) );

        switch (user.role) {
            case 'admin':
                res.redirect('/service/admin');
                break;
            case 'testing':
                res.redirect('/service/testing');
                break;
            case 'member':
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

    const user = req.user as User | undefined;

    if (user && (user.role == 'admin' || user.id == _userid)) {
        switch (_action) {
            case 'get':
                interface FindUserResponse {
                    message?: string;
                    user?: User;
                }

                db.User.findOne({ where: { id: _userid } }).then((user: any | null) => {
                    if (!user) {
                        const response: FindUserResponse = { message: 'Not found.' };
                        return res.status(400).json(response);
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
    const user = req.user as User | undefined;

    if (user && user.role == 'admin') {
        db.User.findAll().then((users: User[]) => {
            // Remove 'salt' and 'hash' from each user
            const safeUsers: SafeUser[] = users.map(user => {
                const { salt, hash, ...safeUser } = userAsJSON(user) as any; // Use toJSON() to get a plain object
                return safeUser as SafeUser;
            });

            res.json(safeUsers);
        }).catch((error: Error) => {
            res.status(500).json({ error: error.message });
        });
    } else {
        res.status(403).send({ message: "Error 3" });
    }
});

router.put('/users/:id/role', (req: Request, res: Response) => {
    if (req.user && (req.user as User).role == 'admin') {
        const userId = req.params.id;
        const newRole = req.body.role;

        console.error(req.body);
        console.error(`${userId} - ${newRole}`);

        db.User.update({ role: newRole }, { where: { id: userId } })
            .then(() => res.status(200).send({ message: 'Role updated successfully' }))
            .catch((error: Error) => res.status(500).send({ message: 'Error updating role', error }));
    } else {
        res.status(403).send({ message: 'Error updating role' });
    }
});

router.post('/users/invite', (req: Request, res: Response) => {
    if (req.user && (req.user as User).role == 'admin') {
        db.User.register({
            username: helperFunctions.generateUsername(req.body.email),
            role: req.body.role,
            email: req.body.email,
            oauthProvider: "vipercloud",
            // created: Date.now()
        }, helperFunctions.generateRandomString(25)/*password*/).then((user: User) => {
            res.status(200).send({ message: 'User invited successfully', user });
        }).catch((err: Error) => {
                return res.status(500).send({ message: 'Error inviting user', err });
        });
    } else {
        res.status(403).send({ message: 'Unauthorized' });
    }
});

router.get('/sessions', (req: Request, res: Response) => {
    if (req.user && (req.user as User).role == 'admin') {
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

router.get('/register', (req: Request, res: Response) => {
    res.render('user_account_register');
});

router.post('/register', (req: Request, res: Response) => {
    db.User.register({
        username: helperFunctions.sanitizeUsername(req.body.username),
        role: "user",
        email: req.body.email,
        oauthProvider: "vipercloud",
        // createdAt: Date.now()
    }, req.body.password).then((user: User) => {
        emailRelay.sendWelcomeEmail(req.body.email, helperFunctions.sanitizeUsername(req.body.username));
        req.flash('alert-success', 'Thanks for setting up a ViPER account - you may need to contact an admin to get full access to the services on offer.');
        req.login(user, (err: Error) => {
            if (err) {
                console.log(err);
                res.status(500).json({ message: 'Error logging in user.' });
            } else {
                res.redirect('/account');
            }
        });

    }).catch((err: Error) => {
        console.log(err);
        res.status(500).json({ message: 'Error creating user.' });
    });
});


router.get('/login', (req: Request, res: Response) => {
    //Force log out? redirect if already logged in?
    const errorMsg = req.flash('error');
    res.render('user_account_login', { error_message: errorMsg });
});


router.post('/login', passport.authenticate('local', { failureRedirect: '/account/login', failureFlash: true }),
    (req, res) => {
        if (req.user) {
            res.redirect('/account');
        } else {
            console.log("Login failed... redirecting....");
            res.redirect('/account/login');
        }
    });

router.get('/logout', (req: Request, res: Response) => {
    req.logout((err) => {
        if (err) {
            res.json(err);
        }
        res.redirect('/account/login')
    });
});

//Google oAuth routes
router.get('/login/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/return', passport.authenticate('google', { failureRedirect: '/account/login', failureFlash: true }), (req, res) => {
    req.flash('alert-success', 'Thanks for setting up a ViPER account - you may need to contact an admin to get full access to the services on offer.');
    res.redirect('/account');
});

router.get('/reset-password',
    function (req: Request, res: Response) {
        res.render('user_account_get_reset_password');
    })

router.post('/reset-password', (req: Request, res: Response) => {
    const { email } = req.body;
    const token = crypto.randomBytes(20).toString('hex');

    db.User.findOne({ where: { email } }).then((user: any | null) => {
        if (!user) {
            // return res.status(400).json({ message: 'No account with that email address exists.' });
            // For security reasons, don't return information that leaks info about the service and users...
            return res.render('user_account_post_reset_password');
        }

        user.update({
            resetPasswordToken: token,
            resetPasswordExpires: Date.now() + 3600000,
        }).then(() => {
            emailRelay.sendResetEmail(email, user.username, token);
            res.render('user_account_post_reset_password');
        }).catch((err: Error) => {
            console.log("Error updating user: ", err);
            // res.status(500).json({ message: 'Error updating user.' });
            res.render('user_account_post_reset_password');
        });
    }).catch((err: Error) => {
        console.log("Error finding user: ", err);
        // res.status(500).json({ message: 'Error finding user.' });
        res.render('user_account_post_reset_password');
    });
});

router.get('/reset-token/:token', (req: Request, res: Response) => {
    const _token = req.params.token;
    interface ResetTokenResponse {
        message?: string;
    }

    db.User.findOne({ where: { resetPasswordToken: _token, resetPasswordExpires: { [Op.gt]: Date.now() } } }).then((user: any | null) => {
        if (!user) {
            const response: ResetTokenResponse = { message: 'Password reset token is invalid or has expired.' };
            return res.status(400).json(response);
        }
        res.render('user_account_get_reset_token', {
            token: _token,
        });
    }).catch((err: Error) => {
        console.log("Error finding user by token: ", err);
        const response: ResetTokenResponse = { message: 'Error finding user.' };
        res.status(500).json(response);
    });
});

router.post('/reset-token', (req: Request, res: Response) => {
    const _token = req.body.token;
    interface ResetTokenResponse {
        message?: string;
    }

    db.User.findOne({ where: { resetPasswordToken: _token, resetPasswordExpires: { [Op.gt]: Date.now() } } }).then((user: any | null) => {
        if (!user) {
            const response: ResetTokenResponse = { message: 'Password reset token is invalid or has expired.' };
            return res.status(400).json(response);
        }

        user.setPassword(req.body.password, (err: Error | null, updatedUser: any) => {
            if (err) {
                console.log("Error setting new password: ", err);
                const response: ResetTokenResponse = { message: 'Error setting new password.' };
                return res.status(500).json(response);
            }
            updatedUser.resetPasswordToken = null; // Clear the reset token
            updatedUser.resetPasswordExpires = null; // Clear the reset token
            updatedUser.save().then(() => {
                res.render('user_account_post_reset_token');
            }).catch((saveErr: Error) => {
                console.log("Error saving user: ", saveErr);
                const response: ResetTokenResponse = { message: 'Error saving user.' };
                res.status(500).json(response);
            });
        });
    }).catch((err: Error) => {
        console.log("Error finding user by token: ", err);
        const response: ResetTokenResponse = { message: 'Error finding user.' };
        res.status(500).json(response);
    });
});



export default router;