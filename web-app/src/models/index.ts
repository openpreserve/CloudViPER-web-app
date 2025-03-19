'use strict';

import * as path from 'path';
import { Sequelize, DataTypes, Dialect } from 'sequelize';
import * as process from 'process';
import dotenv from 'dotenv';

import configAuth from '../config/auth';
import User from './user';
import ViperInstance from './viperinstance';
import Logs from './log'; // Import the Logs model

dotenv.config({ path: "../.env" });

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';

const databasehost = configAuth.mysqlSessionAuth.host;
const database = configAuth.mysqlSessionAuth.database;
const username = configAuth.mysqlSessionAuth.user;
const password = configAuth.mysqlSessionAuth.password;
const config: { host: string; dialect: Dialect, logging: boolean | ((...msg: any[]) => void) } = { "host": databasehost, "dialect": "mysql", logging: console.log};

let sequelize: Sequelize;
sequelize = new Sequelize(database, username, password, config);

const usermodel = User(sequelize);
const vipermodel = ViperInstance(sequelize);
const logsmodel = Logs(sequelize); // Initialize the Logs model

interface DB {
  sequelize: Sequelize;
  Sequelize: typeof Sequelize;
  User: typeof usermodel;
  ViperInstance: typeof vipermodel;
  Logs: typeof logsmodel; // Add Logs to the DB interface
}

const db: DB = {
  sequelize,
  Sequelize,
  User: usermodel,
  ViperInstance: vipermodel,
  Logs: logsmodel, // Add Logs to the db object
};

Object.keys(db).forEach((modelName: string) => {
  if ((db as any)[modelName].associate) {
    (db as any)[modelName].associate(db);
  }
});

db.sequelize.sync({ alter: true }).then(() => {
  console.log('Database synchronized with { alter: true }');
});

export { usermodel, vipermodel, logsmodel }; // Export logsmodel
export default db;
