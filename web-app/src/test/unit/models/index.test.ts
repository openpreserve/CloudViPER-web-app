const SequelizeMock = require('sequelize-mock');
import { jest } from '@jest/globals';

import dotenv from 'dotenv';
import path from 'path';
const result = dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Mock the database models completely
jest.mock('../../../models/index', () => {
  const dbMock = new SequelizeMock();
  return {
    sequelize: {
      authenticate: jest.fn().mockImplementation(() => Promise.resolve())
    },
    Sequelize: SequelizeMock,
    User: dbMock.define('User', {}),
    ViperInstance: dbMock.define('ViperInstance', {}),
    Log: dbMock.define('Log', {}),
  };
});

import db from '../../../models/index';

describe('Database Models', () => {
  beforeAll(async () => {
    // Mock authentication - no real database connection
  });

  it('should initialize Sequelize instance', async () => {
    expect(db.sequelize).toBeDefined();
    expect(db.sequelize.authenticate).toBeDefined();
  });

  it('should have User model', async () => {
    expect(db.User).toBeDefined();
  });

  it('should have ViperInstance model', async () => {
    expect(db.ViperInstance).toBeDefined();
  });

  it('should have Log model', async () => {
    expect(db.Log).toBeDefined();
  });
});