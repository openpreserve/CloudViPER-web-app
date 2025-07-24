import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import Log from '../../../models/log';
import path from 'path';

const result = dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Log Model', () => {
  const sequelizeInstance = new Sequelize(
    process.env.DB_NAME!,
    process.env.DB_USER!,
    process.env.DB_PASSWORD!,
    {
      host: process.env.DB_HOST!,
      dialect: 'mysql',
      logging: false,
    }
  );

  beforeAll(async () => {
    await sequelizeInstance.authenticate();
  });

  it('should initialize the Log model', () => {
    const logModel = Log(sequelizeInstance);
    expect(logModel).toBeDefined();
  });

  it('should have correct model properties', () => {
    const logModel = Log(sequelizeInstance);
    const attributes = logModel.rawAttributes;

    expect(attributes.id).toBeDefined();
    expect(attributes.eventType).toBeDefined();
    expect(attributes.eventDescription).toBeDefined();
    expect(attributes.message).toBeDefined();
    expect(attributes.userId).toBeDefined();
    expect(attributes.viperInstanceId).toBeDefined();
    expect(attributes.browserInfo).toBeDefined();
    expect(attributes.ipAddress).toBeDefined();
    expect(attributes.dockerContainerId).toBeDefined();
    expect(attributes.createdAt).toBeDefined();
    expect(attributes.updatedAt).toBeDefined();
  });

  afterAll(async () => {
    await sequelizeInstance.close();
  });
});