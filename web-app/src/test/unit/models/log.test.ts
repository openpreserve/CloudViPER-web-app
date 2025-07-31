import dotenv from 'dotenv';
import path from 'path';

// Mock Sequelize to avoid real database connections
jest.mock('sequelize', () => {
  const mockSequelize = {
    authenticate: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    define: jest.fn().mockReturnValue({
      rawAttributes: {
        id: {},
        eventType: {},
        eventDescription: {},
        message: {},
        userId: {},
        viperInstanceId: {},
        browserInfo: {},
        ipAddress: {},
        dockerContainerId: {},
        createdAt: {},
        updatedAt: {}
      }
    })
  };
  
  return {
    Sequelize: jest.fn().mockImplementation(() => mockSequelize),
    DataTypes: {
      INTEGER: 'INTEGER',
      STRING: 'STRING',
      TEXT: 'TEXT',
      DATE: 'DATE',
      JSON: 'JSON'
    }
  };
});

// Mock the Log model function
const mockLogModel = {
  rawAttributes: {
    id: {},
    eventType: {},
    eventDescription: {},
    message: {},
    userId: {},
    viperInstanceId: {},
    browserInfo: {},
    ipAddress: {},
    dockerContainerId: {},
    createdAt: {},
    updatedAt: {}
  }
};

jest.mock('../../../models/log', () => {
  return jest.fn().mockReturnValue(mockLogModel);
});

import { Sequelize } from 'sequelize';
import Log from '../../../models/log';

const result = dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Log Model', () => {
  let mockSequelizeInstance: any;

  beforeAll(async () => {
    // Create mock Sequelize instance
    mockSequelizeInstance = new Sequelize();
  });

  it('should initialize the Log model', () => {
    const logModel = Log(mockSequelizeInstance);
    expect(logModel).toBeDefined();
  });

  it('should have correct model properties', () => {
    const logModel = Log(mockSequelizeInstance);
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
    // Clean up mocks
    jest.clearAllMocks();
  });
});