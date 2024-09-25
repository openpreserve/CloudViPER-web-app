const dotenv = require('dotenv').config();
const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');

module.exports = db = {};

initialize();

async function initialize() {
     const sequelize = new Sequelize(
        process.env.DB_NAME, 
        process.env.DB_USER, //'root', 
        process.env.DB_PASSWORD, 
        {   host:process.env.DB_HOST , 
            dialect: 'mysql',
            logging: process.env.NODE_ENV === 'production' ? false : console.log
        }
    );

    // init models and add them to the exported db object
    db.User = require('../models/user')(sequelize);
    db.NPS = require('../models/viperinstances')(sequelize);

    // sync all models with database
    await sequelize.sync({ alter: true });
}