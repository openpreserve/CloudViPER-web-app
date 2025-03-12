import { Sequelize, DataTypes, Model } from 'sequelize';
import crypto from 'crypto';
import sequelize from '../utility/db';
import { Strategy as LocalStrategy } from 'passport-local';

const options = {
    saltlen: 32,
    iterations: 25000,
    keylen: 512,
    digest: 'sha256',
    usernameField: 'username',
    hashField: 'hash',
    saltField: 'salt',
    missingPasswordError: 'Password argument not set!',
    incorrectPasswordError: 'Incorrect password',
    incorrectUsernameError: 'Incorrect username',
    noSaltValueStoredError: 'Authentication not possible. No salt value stored in db!',
    userExistsError: 'User already exists with %s',
    missingUsernameError: 'Field %s is not set',
};

class User extends Model {
    public id!: number;
    public username!: string;
    public email!: string;
    public hash!: string;
    public salt!: string;
    public resetPasswordToken!: string | null;
    public resetPasswordExpires!: Date | null;
    public title?: string;
    public firstName?: string;
    public lastName?: string;
    public role!: string;
    public oauthID?: string;
    public oauthProvider?: string;
    public oauthProfile?: object;

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

    public static createStrategy() {
        return new LocalStrategy({ usernameField: options.usernameField }, (username, password, done) => {
            this.findOne({ where: { [options.usernameField]: username } })
                .then((user: User | null) => {
                    if (!user) {
                        return done(null, false, { message: options.incorrectUsernameError });
                    }

                    user.authenticate(password)
                        .then((authenticatedUser) => {
                            if (authenticatedUser) {
                                return done(null, user);
                            } else {
                                return done(null, false, { message: options.incorrectPasswordError });
                            }
                        })
                        .catch(done);
                })
                .catch(done);
        });
    }

    public static register(user: User, password: string): Promise<User> {
        return new Promise((resolve, reject) => {
            this.findOne({ where: { [options.usernameField]: (user as any)[options.usernameField] } })
                .then((existingUser: User | null) => {
                    if (existingUser) {
                        return reject(new Error(options.userExistsError.replace('%s', (user as any)[options.usernameField])));
                    }

                    user.setPassword(password)
                        .then(() => user.save())
                        .then(resolve)
                        .catch(reject);
                })
                .catch(reject);
        });
    }
}

export const initUserModel = (sequelize: Sequelize) => {
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
            hash: { type: DataTypes.STRING },
            resetPasswordToken: { type: DataTypes.STRING },
            resetPasswordExpires: { type: DataTypes.DATE },
            oauthProfile: { type: DataTypes.JSON },
        },
        {
            sequelize,
            modelName: 'User',
        }
    );

    return User;
};

export default User;