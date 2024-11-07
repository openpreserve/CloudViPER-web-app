const { DataTypes } = require('sequelize');

function model(sequelize) {
    const attributes = {
        // owner: {
        //     type: DataTypes.STRING,
        //     allowNull: true,
        // },        
        uuid: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        dockerid: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW, // Set a default value if needed
        },
    };

    return sequelize.define('ViperInstances', attributes);
}

module.exports = model;