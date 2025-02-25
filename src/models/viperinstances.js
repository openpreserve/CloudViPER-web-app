const { DataTypes } = require('sequelize');

function model(sequelize) {
    const attributes = {
        owner: {
            type: DataTypes.STRING,
            allowNull: true,
        },        
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
        kasmvncPassword:{
            type: DataTypes.STRING,
            allowNull: true,
        },
        statusKey:{
            type: DataTypes.STRING,
            allowNull: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'initilising' //begin_cert, cert_issued, active, begin_delete, deleted,
        },
        logs: {  // New field for logs
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: [], // Initialize as an empty array
        },
    };

    return sequelize.define('ViperInstances', attributes);
}

module.exports = model;