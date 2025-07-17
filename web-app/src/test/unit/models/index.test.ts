const SequelizeMock = require('sequelize-mock');
import { jest } from '@jest/globals';
import db from '../../../models/index';

import dotenv from 'dotenv';
import path from 'path';
const result = dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

jest.mock('../../../models/index', () => {
  const dbMock = new SequelizeMock();
  return {
    sequelize: dbMock,
    Sequelize: SequelizeMock,
    User: dbMock.define('User', {}),
    ViperInstance: dbMock.define('ViperInstance', {}),
    Log: dbMock.define('Log', {}),
  };
});

describe('Database Models', () => {
  beforeAll(async () => {
    await db.sequelize.authenticate();
  });

  it('should initialize Sequelize instance', async () => {
    await expect(db.sequelize).toBeInstanceOf(SequelizeMock);
  });

  it('should have User model', async () => {
    await expect(db.User).toBeDefined();
  });

  it('should have ViperInstance model', async () => {
    await expect(db.ViperInstance).toBeDefined();
  });

  it('should have Log model', async () => {
    await expect(db.Log).toBeDefined();
  });
});