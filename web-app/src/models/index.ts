'use strict';

import * as path from 'path';
import { Sequelize, DataTypes, Dialect } from 'sequelize';
import * as process from 'process';
import dotenv from 'dotenv';

import configAuth from '../config/auth';
import User from './user';
import ViperInstance from './viperinstance';

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

interface DB {
  sequelize: Sequelize;
  Sequelize: typeof Sequelize;
  User: typeof usermodel;
  ViperInstance: typeof vipermodel;
}

const db: DB = {
  sequelize,
  Sequelize,
  User: usermodel,
  ViperInstance: vipermodel,
};

Object.keys(db).forEach((modelName: string) => {
  if ((db as any)[modelName].associate) {
    (db as any)[modelName].associate(db);
  }
});

db.sequelize.sync({ alter: true }).then(() => {
  console.log('Drop and Resync with { force: true }');
});

export { usermodel, vipermodel };
export default db;
