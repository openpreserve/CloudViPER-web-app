import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';
import userModel from '../models/user';
import viperInstanceModel from '../models/viperinstances';

dotenv.config();

const db: any = {};

initialize();

async function initialize() {
    const sequelize = new Sequelize(
        process.env.DB_NAME!,
        process.env.DB_USER!, //'root', 
        process.env.DB_PASSWORD!,
        {
            host: process.env.DB_HOST,
            dialect: 'mysql',
            logging: process.env.NODE_ENV === 'production' ? false : console.log
        }
    );

    // init models and add them to the exported db object
    db.User = userModel(sequelize);
    db.ViperInstance = viperInstanceModel(sequelize);

    // sync all models with database
    await sequelize.sync({ alter: true });
}

export default db;