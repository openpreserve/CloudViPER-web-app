import { DataTypes, Model, Sequelize } from 'sequelize';

class Log extends Model {
    public id!: number;
    public eventType!: string;
    public eventDescription!: string;
    public userId!: number | null;
    public viperInstanceId!: number | null;
    public browserInfo!: string | null;
    public ipAddress!: string | null;
    public dockerContainerId!: string | null;
    public createdAt!: Date;
    public updatedAt!: Date;
}

export default (sequelize: Sequelize) => {
    Log.init(
        {
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            eventType: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            eventDescription: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            userId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
            },
            viperInstanceId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
            },
            browserInfo: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ipAddress: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            dockerContainerId: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            sequelize,
            tableName: 'Logs',
            timestamps: true,
        }
    );

    return Log;
}