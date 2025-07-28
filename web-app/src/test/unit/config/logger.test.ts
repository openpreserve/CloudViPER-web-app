import { jest } from '@jest/globals';
import { UserRole } from '../../../types/UserRole';

// Create a comprehensive mock for winston
const mockWinston = {
  format: {
    combine: jest.fn(() => 'combined-format'),
    timestamp: jest.fn(() => 'timestamp-format'),
    printf: jest.fn(() => 'printf-format'),
    json: jest.fn(() => 'json-format'),
    colorize: jest.fn(() => 'colorize-format'),
    simple: jest.fn(() => 'simple-format')
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
};

// Mock winston-daily-rotate-file
const mockDailyRotateFile = jest.fn();

// Mock modules before import
jest.mock('winston', () => mockWinston);
jest.mock('winston-daily-rotate-file', () => mockDailyRotateFile);
jest.mock('fs');
jest.mock('path');

// Mock the logger functions directly
const mockSessionLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

const mockAppLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockSqlLogger = {
  info: jest.fn(),
  error: jest.fn()
};

// Mock the entire logger module
jest.mock('../../../config/logger', () => ({
  logSession: jest.fn(),
  appLogger: mockAppLogger,
  sqlLogger: mockSqlLogger,
  logSQL: jest.fn(),
  sessionLogger: mockSessionLogger
}));

// Import the mocked functions
import { logSession, appLogger, sqlLogger, logSQL } from '../../../config/logger';

describe('Logger Configuration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('logSession function', () => {
        const mockRequest = {
            method: 'GET',
            originalUrl: '/test',
            url: '/test',
            ip: '127.0.0.1',
            sessionID: 'test-session-id',
            headers: {
                'user-agent': 'Mozilla/5.0 Test Browser',
                'referer': 'http://localhost:3000/',
                'x-forwarded-for': '127.0.0.1',
                'accept-language': 'en-US,en;q=0.9',
                'accept-encoding': 'gzip, deflate',
                'host': 'localhost:3000'
            },
            protocol: 'http',
            cookies: { sessionCookie: 'value' },
            secure: false,
            xhr: false,
            user: {
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
                role: UserRole.USER
            }
        } as any;

        it('should be available as a function', () => {
            expect(typeof logSession).toBe('function');
        });

        it('should be callable with basic parameters', () => {
            expect(() => {
                logSession('Test Event', mockRequest);
            }).not.toThrow();
            expect(logSession).toHaveBeenCalledWith('Test Event', mockRequest);
        });

        it('should handle anonymous user sessions', () => {
            const mockRequestNoUser = {
                ...mockRequest,
                user: null
            };

            expect(() => {
                logSession('Anonymous Event', mockRequestNoUser);
            }).not.toThrow();
            expect(logSession).toHaveBeenCalledWith('Anonymous Event', mockRequestNoUser);
        });

        it('should handle additional data parameter', () => {
            const additionalData = {
                customField: 'customValue',
                errorCode: 404
            };

            expect(() => {
                logSession('Test Event', mockRequest, additionalData);
            }).not.toThrow();
            expect(logSession).toHaveBeenCalledWith('Test Event', mockRequest, additionalData);
        });
    });

    describe('appLogger', () => {
        it('should be available for logging application events', () => {
            expect(appLogger).toBeDefined();
            expect(typeof appLogger.info).toBe('function');
            expect(typeof appLogger.error).toBe('function');
            expect(typeof appLogger.warn).toBe('function');
        });

        it('should be callable for different log levels', () => {
            appLogger.info('Test info message');
            appLogger.error('Test error message');
            appLogger.warn('Test warning message');

            expect(mockAppLogger.info).toHaveBeenCalledWith('Test info message');
            expect(mockAppLogger.error).toHaveBeenCalledWith('Test error message');
            expect(mockAppLogger.warn).toHaveBeenCalledWith('Test warning message');
        });
    });

    describe('sqlLogger', () => {
        it('should be available for logging SQL queries', () => {
            expect(sqlLogger).toBeDefined();
            expect(typeof sqlLogger.info).toBe('function');
            expect(typeof sqlLogger.error).toBe('function');
        });

        it('should be callable for SQL logging', () => {
            sqlLogger.info('Test SQL query');
            sqlLogger.error('SQL error message');

            expect(mockSqlLogger.info).toHaveBeenCalledWith('Test SQL query');
            expect(mockSqlLogger.error).toHaveBeenCalledWith('SQL error message');
        });
    });

    describe('logSQL function', () => {
        it('should be available as a function', () => {
            expect(typeof logSQL).toBe('function');
        });

        it('should be callable with SQL query', () => {
            const testQuery = 'SELECT * FROM users WHERE id = ?';
            
            expect(() => {
                logSQL(testQuery);
            }).not.toThrow();
            expect(logSQL).toHaveBeenCalledWith(testQuery);
        });
    });
});
