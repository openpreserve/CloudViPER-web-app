'use strict';

import { Model, DataTypes, Sequelize } from 'sequelize';

interface ScreenshotAttributes {
    id?: number;
    instanceId: number;
    instanceUUID: string;
    screenshotData: string; // base64 encoded image
    capturedAt?: Date;
    receivedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export default (sequelize: Sequelize) => {
    class Screenshot extends Model<ScreenshotAttributes> implements ScreenshotAttributes {
        public id?: number;
        public instanceId!: number;
        public instanceUUID!: string;
        public screenshotData!: string;
        public capturedAt?: Date;
        public receivedAt?: Date;
        public createdAt?: Date;
        public updatedAt?: Date;

        static associate(models: any) {
            // Define association with ViperInstance
            Screenshot.belongsTo(models.ViperInstance, {
                foreignKey: 'instanceId',
                as: 'instance'
            });
        }
    }

    Screenshot.init({
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
        screenshotData: { 
            type: DataTypes.TEXT('long'), // Use LONGTEXT for large base64 data
            allowNull: false 
        },
        capturedAt: { 
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
        modelName: 'Screenshot',
        indexes: [
            {
                fields: ['instanceId', 'createdAt']
            },
            {
                fields: ['instanceUUID']
            }
        ]
    });

    return Screenshot;
};
