'use strict';

import { Model, DataTypes, Sequelize } from 'sequelize';

interface ViperInstanceAttributes {
    id?: number;
    owner: number;
    uuid: string;
    dockerid: string;
    name: string;
    url: string;
    kasmvncPassword: string;
    statusKey: string;
    createdAt?: Date;
    updatedAt?: Date;
    status: string;
    logs: any[];
  }

export default (sequelize: Sequelize) => {
    class ViperInstance extends Model<ViperInstanceAttributes> implements ViperInstanceAttributes {
        public id?: number;
        public owner!: number;
        public uuid!: string;
        public dockerid!: string;
        public name!: string;
        public url!: string;
        public kasmvncPassword!: string;
        public statusKey!: string;
        public createdAt?: Date;
        public updatedAt?: Date;
        public status!: string;
        public logs!: any[];
    
        static associate(models: any) {
          // define association here
          ViperInstance.belongsTo(models.User, {
            foreignKey: 'owner',
            as: 'ownerUser'
          });
        }
    }

    ViperInstance.init({
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        owner: { type: DataTypes.INTEGER, allowNull: true },
        uuid: { type: DataTypes.STRING, allowNull: true },
        dockerid: { type: DataTypes.STRING, allowNull: true },
        name: { type: DataTypes.STRING, allowNull: true },
        url: { type: DataTypes.STRING, allowNull: true },
        kasmvncPassword: { type: DataTypes.STRING, allowNull: true },
        statusKey: { type: DataTypes.STRING, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'initilising' },
        logs: { type: DataTypes.JSON, allowNull: true, defaultValue: [] }, // Initialize as an empty array
    }, {
        sequelize,
        modelName: 'ViperInstance',
    });

    return ViperInstance;
};