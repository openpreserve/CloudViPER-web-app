import sequelize from '../utility/db';
import { initUserModel } from './user';
import { initViperInstanceModel } from './viperInstance';

// Initialize models
const User = initUserModel(sequelize);
const ViperInstance = initViperInstanceModel(sequelize);

// Sync database
sequelize.sync({ alter: true })
    .then(() => {
        console.log('Database synchronized');
    })
    .catch((err) => {
        console.error('Error synchronizing database:', err);
    });

export { User, ViperInstance };