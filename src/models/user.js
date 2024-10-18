const passport = require('passport');
const Sequelize = require('sequelize'); //this is passed in as lowercase sequelize.... refactor?
const passportLocalSequelize = require('passport-local-sequelize');

function model(sequelize) {
    const attributes = {
        username: { type: Sequelize.STRING, unique: true, allowNull: false },
        email: { type: Sequelize.STRING, unique: true, allowNull: false, validate: { isEmail: true } },
        title: { type: Sequelize.STRING, allowNull: true },
        firstName: { type: Sequelize.STRING, allowNull: true },
        lastName: { type: Sequelize.STRING, allowNull: true },
        role: { type: Sequelize.STRING, allowNull: false },

        oauthID: { type: Sequelize.STRING },
        oauthProvider: { type: Sequelize.STRING },

        salt: { type: Sequelize.JSON },
        hash: { type: Sequelize.JSON },

        resetPasswordToken: { type: Sequelize.STRING },
        resetPasswordExpires: { type: Sequelize.DATE },
        oauthProfile: { type: Sequelize.JSON },

    };

    const options = {
        defaultScope: {
            // exclude password hash by default
            attributes: { exclude: ['passwordHash'] }
        },
        scopes: {
            // include hash with this scope
            withHash: { attributes: {}, }
        },
        define: {
            indexes: [
                {
                    unique: true,
                    fields: ['email', 'username']
                }
            ]
        },
    };

    var User = sequelize.define('User', attributes, options);
    passportLocalSequelize.attachToUser(User, {
        usernameField: 'username',
        hashField: 'hash',
        saltField: 'salt'
    });

    return User;
}


module.exports = model;