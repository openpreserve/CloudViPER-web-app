'use strict';

import { Sequelize, DataTypes, Model } from 'sequelize';
import crypto from 'crypto';
import util from 'util';

/*
ROLES:

user - nothing
testing - can run one viper
member - can run one viper
subscriber - pays for use
admin - viper and user management

*/

const options = {
    saltlen: 32,
    iterations: 25000,
    keylen: 512,
    digest: 'sha256',
    usernameField: 'email',
    hashField: 'hash',
    saltField: 'salt',
    missingPasswordError: 'Password argument not set!',
    incorrectPasswordError: 'Incorrect password',
    incorrectUsernameError: 'Incorrect username',
    noSaltValueStoredError: 'Authentication not possible. No salt value stored in db!',
    userExistsError: 'User already exists with %s',
    missingUsernameError: 'Field %s is not set',
};

interface UserAttributes {
    id?: number;
    username: string;
    email: string;
    title?: string;
    firstName?: string;
    lastName?: string;
    role: string;
    oauthID?: string;
    oauthProvider?: string;
    salt?: string;
    hash?: string;
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
    oauthProfile?: object;
    createdAt?: Date;
    updatedAt?: Date;
}

export default (sequelize: Sequelize) => {
    class User extends Model<UserAttributes> implements UserAttributes {
        public id!: number;
        public username!: string;
        public email!: string;
        public title?: string;
        public firstName?: string;
        public lastName?: string;
        public role!: string;
        public oauthID?: string;
        public oauthProvider?: string;
        public salt?: string;
        public hash?: string;
        public resetPasswordToken?: string;
        public resetPasswordExpires?: Date;
        public oauthProfile?: object;
        public readonly createdAt!: Date;
        public readonly updatedAt!: Date;

        public static async register(userDetails: Partial<UserAttributes>, password: string): Promise<User> {
            if (!userDetails.email) {
                throw new Error(util.format(options.missingUsernameError, options.usernameField));
            }
            const user = this.build(userDetails as UserAttributes);

            if (!user.email) {
                throw new Error(util.format(options.missingUsernameError, options.usernameField));
            }

            const existingUser = await this.findOne({ where: { email: user.email } });
            if (existingUser) {
                throw new Error(util.format(options.userExistsError, user.email));
            }

            await user.setPassword(password);
            await user.save();
            return user;
        }    

        public setPassword(password: string): Promise<void> {
            return new Promise((resolve, reject) => {
                if (!password) {
                    return reject(new Error(options.missingPasswordError));
                }

                crypto.randomBytes(options.saltlen, (err, buf) => {
                    if (err) {
                        return reject(err);
                    }

                    const salt = buf.toString('hex');

                    crypto.pbkdf2(password, salt, options.iterations, options.keylen, options.digest, (err, hashRaw) => {
                        if (err) {
                            return reject(err);
                        }

                        this.hash = Buffer.from(hashRaw).toString('hex');
                        console.log("Hash: ", this.hash);
                        this.salt = salt;

                        resolve();
                    });
                });
            });
        }

        public authenticate(password: string): Promise<User | boolean> {
            return new Promise((resolve, reject) => {
                if (!this.salt) {
                    return reject(new Error(options.noSaltValueStoredError));
                }

                crypto.pbkdf2(password, this.salt, options.iterations, options.keylen, options.digest, (err, hashRaw) => {
                    if (err) {
                        return reject(err);
                    }

                    const hash = Buffer.from(hashRaw).toString('hex');

                    if (hash === this.hash) {
                        resolve(this);
                    } else {
                        resolve(false);
                    }
                });
            });
        }

        static async authenticateUser(email: string, password: string): Promise<User | boolean> {
            try {
                const user = await User.findOne({ where: { email } });
                if (!user) {
                    return false;
                }
                return user.authenticate(password);
            } catch (error) {
                console.error("Authentication Error:", error);
                return false;
            }
        }

        static associate(models: any) {
            // define association here
        }
    }

    User.init(
        {
            id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
            username: { type: DataTypes.STRING, allowNull: false },
            email: { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
            title: { type: DataTypes.STRING, allowNull: true },
            firstName: { type: DataTypes.STRING, allowNull: true },
            lastName: { type: DataTypes.STRING, allowNull: true },
            role: { type: DataTypes.STRING, allowNull: false },
            oauthID: { type: DataTypes.STRING },
            oauthProvider: { type: DataTypes.STRING },
            salt: { type: DataTypes.STRING },
            hash: { type: DataTypes.TEXT },
            resetPasswordToken: { type: DataTypes.STRING },
            resetPasswordExpires: { type: DataTypes.DATE },
            oauthProfile: { type: DataTypes.JSON },
            createdAt: { type: DataTypes.DATE },
            updatedAt: { type: DataTypes.DATE },
        },
        {
            sequelize,
            modelName: 'User',
            defaultScope: {
                // exclude password hash by default
                attributes: { exclude: ['salt', 'hash'] },
            },
        }
    );

    return User;
};