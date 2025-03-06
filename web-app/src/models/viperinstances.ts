import { Sequelize, DataTypes, Model, Optional } from 'sequelize';

interface ViperInstanceAttributes {
    owner?: string;
    uuid?: string;
    dockerid?: string;
    name?: string;
    url?: string;
    kasmvncPassword?: string;
    statusKey?: string;
    createdAt?: Date;
    status: string;
    logs?: object;
}

interface ViperInstanceCreationAttributes extends Optional<ViperInstanceAttributes, 'status'> {}

class ViperInstance extends Model<ViperInstanceAttributes, ViperInstanceCreationAttributes> implements ViperInstanceAttributes {
    public owner?: string;
    public uuid?: string;
    public dockerid?: string;
    public name?: string;
    public url?: string;
    public kasmvncPassword?: string;
    public statusKey?: string;
    public createdAt?: Date;
    public status!: string;
    public logs?: object;
}

function model(sequelize: Sequelize) {
    ViperInstance.init(
        {
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
        },
        {
            sequelize,
            modelName: 'ViperInstance',
        }
    );

    return ViperInstance;
}

export default model;