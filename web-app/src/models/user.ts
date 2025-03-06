import passport from 'passport';
import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
const passportLocalSequelize = require('passport-local-sequelize');

/*
ROLES:

user - nothing
testing - can run one viper
member - can run one viper
subscriber - pays for use
admin - viper and user management

*/

interface UserAttributes {
    id: number;
    username: string;
    email: string;
    title?: string;
    firstName?: string;
    lastName?: string;
    role: string;
    oauthID?: string;
    oauthProvider?: string;
    salt?: object;
    hash?: object;
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
    oauthProfile?: object;
    createdAt?: Date;
    updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
    public id!: number;
    public username!: string;
    public email!: string;
    public title?: string;
    public firstName?: string;
    public lastName?: string;
    public role!: string;
    public oauthID?: string;
    public oauthProvider?: string;
    public salt?: object;
    public hash?: object;
    public resetPasswordToken?: string;
    public resetPasswordExpires?: Date;
    public oauthProfile?: object;
    public createdAt?: Date;
    public updatedAt?: Date;
}

function model(sequelize: Sequelize) {
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
            salt: { type: DataTypes.JSON },
            hash: { type: DataTypes.JSON },
            resetPasswordToken: { type: DataTypes.STRING },
            resetPasswordExpires: { type: DataTypes.DATE },
            oauthProfile: { type: DataTypes.JSON },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        },
        {
            sequelize,
            modelName: 'User',
            defaultScope: {
                // exclude password hash by default
                attributes: { exclude: ['hash'] },
            },
            timestamps: true, // Enable timestamps
        }
    );

    passportLocalSequelize.attachToUser(User, {
        usernameField: 'username',
        hashField: 'hash',
        saltField: 'salt',
    });

    return User;
}

export default model;