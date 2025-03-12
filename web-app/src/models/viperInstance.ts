import { Sequelize, DataTypes, Model } from 'sequelize';

class ViperInstance extends Model {
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

export const initViperInstanceModel = (sequelize: Sequelize) => {
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
};

export default ViperInstance;