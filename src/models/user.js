const Sequelize = require('sequelize'); //this is passed in as lowercase sequelize.... refactor?
const passportLocalSequelize = require('passport-local-sequelize');

function model(sequelize) {
    const attributes = {
        nickname: { type: Sequelize.JSON },
        email: { type: Sequelize.STRING, allowNull: false },
        passwordHash: { type: Sequelize.STRING, allowNull: false },
        title: { type: Sequelize.STRING, allowNull: false },
        firstName: { type: Sequelize.STRING, allowNull: false },
        lastName: { type: Sequelize.STRING, allowNull: false },
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
        }
    };

    var User = sequelize.define('User', attributes, options);
    passportLocalSequelize.attachToUser(User, {
        usernameField: 'nickname',
        hashField: 'hash',
        saltField: 'salt'
    });

    return sequelize.define('User', attributes, options);
}


module.exports = model;