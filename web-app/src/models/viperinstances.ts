import { Sequelize, DataTypes } from 'sequelize';

function model(sequelize: Sequelize) {
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
        kasmvncPassword: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        statusKey: {
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
        },
        logs: {  
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: [], // Initialize as an empty array
        },
    };

    const options = {
        sequelize,
        modelName: 'ViperInstance',
    };

    sequelize.define('ViperInstance', attributes, options);
}

export default model;