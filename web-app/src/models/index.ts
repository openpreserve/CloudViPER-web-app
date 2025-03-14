'use strict';

import * as path from 'path';
import { Sequelize, DataTypes, Dialect } from 'sequelize';
import * as process from 'process';
import dotenv from 'dotenv';

import configAuth from '../config/auth';

dotenv.config({ path: "../.env" });
// console.log(process.env);


const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const db: { [key: string]: any } = {};

const databasehost = configAuth.mysqlSessionAuth.host;
const database = configAuth.mysqlSessionAuth.database;
const username = configAuth.mysqlSessionAuth.user;
const password = configAuth.mysqlSessionAuth.password;
const config: { host: string; dialect: Dialect, logging: boolean | ((...msg: any[]) => void) } = { "host": databasehost, "dialect": "mysql", logging: console.log};

let sequelize: Sequelize;
sequelize = new Sequelize(database, username, password, config);


const User = require('./user');
const usermodel = User(sequelize, DataTypes);
db[usermodel.name] = usermodel;

const ViperInstance = require('./viperinstance');
const vipermodel = ViperInstance(sequelize, DataTypes);
db[vipermodel.name] = vipermodel;

Object.keys(db).forEach((modelName: string) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.sequelize.sync({ alter: true }).then(() => {

  console.log('Drop and Resync with { force: true }');
  //console.error('Unable to create tables, shutting down...', error);
  //process.exit(1);
});

export default db;
