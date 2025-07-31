'use strict';

import { Model, DataTypes, Sequelize } from 'sequelize';

interface ActivityAttributes {
    id?: number;
    instanceId: number;
    instanceUUID: string;
    mouseEvents: number;
    keyboardEvents: number;
    windowActive: boolean;
    cpuUsage: number;
    memoryUsage: number;
    activityScore: number;
    reportedAt?: Date;
    receivedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export default (sequelize: Sequelize) => {
    class Activity extends Model<ActivityAttributes> implements ActivityAttributes {
        public id?: number;
        public instanceId!: number;
        public instanceUUID!: string;
        public mouseEvents!: number;
        public keyboardEvents!: number;
        public windowActive!: boolean;
        public cpuUsage!: number;
        public memoryUsage!: number;
        public activityScore!: number;
        public reportedAt?: Date;
        public receivedAt?: Date;
        public createdAt?: Date;
        public updatedAt?: Date;

        static associate(models: any) {
            // Define association with ViperInstance
            Activity.belongsTo(models.ViperInstance, {
                foreignKey: 'instanceId',
                as: 'instance'
            });
        }
    }

    Activity.init({
        id: { 
            type: DataTypes.INTEGER, 
            autoIncrement: true, 
            primaryKey: true 
        },
        instanceId: { 
            type: DataTypes.INTEGER, 
            allowNull: false,
            references: {
                model: 'ViperInstances',
                key: 'id'
            }
        },
        instanceUUID: { 
            type: DataTypes.STRING, 
            allowNull: false 
        },
        mouseEvents: { 
            type: DataTypes.INTEGER, 
            allowNull: false, 
            defaultValue: 0 
        },
        keyboardEvents: { 
            type: DataTypes.INTEGER, 
            allowNull: false, 
            defaultValue: 0 
        },
        windowActive: { 
            type: DataTypes.BOOLEAN, 
            allowNull: false, 
            defaultValue: false 
        },
        cpuUsage: { 
            type: DataTypes.DECIMAL(5, 2), 
            allowNull: false, 
            defaultValue: 0 
        },
        memoryUsage: { 
            type: DataTypes.DECIMAL(5, 2), 
            allowNull: false, 
            defaultValue: 0 
        },
        activityScore: { 
            type: DataTypes.INTEGER, 
            allowNull: false, 
            defaultValue: 0 
        },
        reportedAt: { 
            type: DataTypes.DATE, 
            allowNull: true 
        },
        receivedAt: { 
            type: DataTypes.DATE, 
            allowNull: false, 
            defaultValue: DataTypes.NOW 
        },
        createdAt: { 
            type: DataTypes.DATE, 
            allowNull: false, 
            defaultValue: DataTypes.NOW 
        },
        updatedAt: { 
            type: DataTypes.DATE, 
            allowNull: false, 
            defaultValue: DataTypes.NOW 
        }
    }, {
        sequelize,
        modelName: 'Activity',
        indexes: [
            {
                fields: ['instanceId', 'createdAt']
            },
            {
                fields: ['instanceUUID']
            },
            {
                fields: ['activityScore']
            }
        ]
    });

    return Activity;
};
