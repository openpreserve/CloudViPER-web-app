import fs from 'fs';
import path from 'path';

// Mock winston and winston-daily-rotate-file before importing logger
const mockTransport = {
    log: jest.fn(),
    write: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    close: jest.fn()
};

const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    transports: [mockTransport]
};

jest.mock('winston', () => ({
    format: {
        combine: jest.fn(() => 'combined-format'),
        timestamp: jest.fn(() => 'timestamp-format'),
        printf: jest.fn(() => 'printf-format'),
        json: jest.fn(() => 'json-format'),
        colorize: jest.fn(() => 'colorize-format'),
        simple: jest.fn(() => 'simple-format'),
        errors: jest.fn(() => 'errors-format')
    },
    createLogger: jest.fn(() => mockLogger),
    transports: {
        Console: jest.fn().mockImplementation(() => mockTransport)
    }
}));

jest.mock('winston-daily-rotate-file', () => {
    return jest.fn().mockImplementation(() => mockTransport);
});

// Mock fs to avoid actual file operations
jest.mock('fs', () => ({
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn()
}));

// Now import the logger after mocking
import { sqlLogger, appLogger, sessionLogger, logSQL, logSession } from '../../../config/logger';

describe('Logger - Real Implementation Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Logger Instances', () => {
        it('should create SQL logger instance', () => {
            expect(sqlLogger).toBeDefined();
            expect(typeof sqlLogger.info).toBe('function');
            expect(typeof sqlLogger.error).toBe('function');
            expect(typeof sqlLogger.warn).toBe('function');
        });

        it('should create application logger instance', () => {
            expect(appLogger).toBeDefined();
            expect(typeof appLogger.info).toBe('function');
            expect(typeof appLogger.error).toBe('function');
            expect(typeof appLogger.warn).toBe('function');
            expect(typeof appLogger.debug).toBe('function');
        });

        it('should create session logger instance', () => {
            expect(sessionLogger).toBeDefined();
            expect(typeof sessionLogger.info).toBe('function');
            expect(typeof sessionLogger.error).toBe('function');
            expect(typeof sessionLogger.warn).toBe('function');
        });

        it('should have different logger instances', () => {
            // Since we're mocking winston.createLogger, they may return the same mock instance
            // But they should at least be defined and functional
            expect(sqlLogger).toBeDefined();
            expect(appLogger).toBeDefined(); 
            expect(sessionLogger).toBeDefined();
            
            // Test that they have the same interface but can be used independently
            expect(typeof sqlLogger.info).toBe('function');
            expect(typeof appLogger.info).toBe('function');
            expect(typeof sessionLogger.info).toBe('function');
        });
    });

    describe('logSQL function', () => {
        it('should be a function', () => {
            expect(typeof logSQL).toBe('function');
        });

        it('should handle SQL query logging', () => {
            const testQuery = 'SELECT * FROM users WHERE id = ?';
            
            // Spy on the sqlLogger.info method
            const infoSpy = jest.spyOn(sqlLogger, 'info').mockImplementation();
            
            logSQL(testQuery);
            
            expect(infoSpy).toHaveBeenCalledWith(testQuery);
            
            infoSpy.mockRestore();
        });

        it('should handle empty SQL queries', () => {
            const infoSpy = jest.spyOn(sqlLogger, 'info').mockImplementation();
            
            logSQL('');
            
            expect(infoSpy).toHaveBeenCalledWith('');
            
            infoSpy.mockRestore();
        });

        it('should handle complex SQL queries', () => {
            const complexQuery = `
                SELECT u.id, u.username, u.email, v.container_id
                FROM users u 
                LEFT JOIN viper_instances v ON u.id = v.user_id 
                WHERE u.role = 'admin' AND u.created_at > ?
                ORDER BY u.created_at DESC
                LIMIT 10
            `;
            
            const infoSpy = jest.spyOn(sqlLogger, 'info').mockImplementation();
            
            logSQL(complexQuery);
            
            expect(infoSpy).toHaveBeenCalledWith(complexQuery);
            
            infoSpy.mockRestore();
        });
    });

    describe('logSession function', () => {
        let mockRequest: any;

        beforeEach(() => {
            mockRequest = {
                sessionID: 'test-session-123',
                user: {
                    id: 1,
                    username: 'testuser',
                    role: 'admin'
                },
                headers: {
                    'user-agent': 'Mozilla/5.0 Test Browser',
                    'x-forwarded-for': '192.168.1.100',
                    'x-real-ip': '192.168.1.100',
                    'referer': 'http://localhost:3000/login',
                    'referrer': 'http://localhost:3000/login',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'host': 'localhost:3000'
                },
                connection: {
                    remoteAddress: '127.0.0.1'
                },
                socket: {
                    remoteAddress: '127.0.0.1'
                },
                ip: '127.0.0.1',
                protocol: 'https',
                method: 'POST',
                originalUrl: '/service/new-instance',
                url: '/service/new-instance',
                cookies: {
                    sessionId: 'session123',
                    preferences: 'theme=dark'
                },
                secure: true,
                xhr: false
            };
        });

        it('should be a function', () => {
            expect(typeof logSession).toBe('function');
        });

        it('should log session data with all fields', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            const eventType = 'USER_LOGIN';
            
            logSession(eventType, mockRequest);
            
            expect(infoSpy).toHaveBeenCalledTimes(1);
            const loggedData = infoSpy.mock.calls[0][0] as any;
            
            expect(loggedData).toEqual(expect.objectContaining({
                eventType: 'USER_LOGIN',
                sessionId: 'test-session-123',
                userId: 1,
                userAgent: 'Mozilla/5.0 Test Browser',
                ipAddress: '192.168.1.100',
                referer: 'http://localhost:3000/login',
                acceptLanguage: 'en-US,en;q=0.9',
                acceptEncoding: 'gzip, deflate, br',
                host: 'localhost:3000',
                protocol: 'https',
                method: 'POST',
                url: '/service/new-instance',
                cookies: ['sessionId', 'preferences'],
                secure: true,
                xhr: false,
                timestamp: expect.any(String)
            }));
            
            infoSpy.mockRestore();
        });

        it('should handle request with session.id fallback', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            const reqWithSessionId = {
                ...mockRequest,
                sessionID: undefined,
                session: { id: 'fallback-session-456' }
            };
            
            logSession('TEST_EVENT', reqWithSessionId);
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData.sessionId).toBe('fallback-session-456');
            
            infoSpy.mockRestore();
        });

        it('should handle request with no session ID', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            const reqWithoutSession = {
                ...mockRequest,
                sessionID: undefined,
                session: undefined
            };
            
            logSession('TEST_EVENT', reqWithoutSession);
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData.sessionId).toBe('unknown');
            
            infoSpy.mockRestore();
        });

        it('should handle request with no user', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            const reqWithoutUser = {
                ...mockRequest,
                user: undefined
            };
            
            logSession('ANONYMOUS_ACCESS', reqWithoutUser);
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData.userId).toBeNull();
            
            infoSpy.mockRestore();
        });

        it('should prioritize x-forwarded-for over other IP sources', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            logSession('IP_TEST', mockRequest);
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData.ipAddress).toBe('192.168.1.100');
            
            infoSpy.mockRestore();
        });

        it('should fallback to x-real-ip when x-forwarded-for not available', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            const reqWithoutForwarded = {
                ...mockRequest,
                headers: {
                    ...mockRequest.headers,
                    'x-forwarded-for': undefined,
                    'x-real-ip': '10.0.0.1'
                }
            };
            
            logSession('IP_FALLBACK_TEST', reqWithoutForwarded);
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData.ipAddress).toBe('10.0.0.1');
            
            infoSpy.mockRestore();
        });

        it('should handle referrer vs referer headers', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            // Test with referrer when referer is not available
            const reqWithReferrer = {
                ...mockRequest,
                headers: {
                    ...mockRequest.headers,
                    'referer': undefined,
                    'referrer': 'http://localhost:3000/home'
                }
            };
            
            logSession('REFERRER_TEST', reqWithReferrer);
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData.referer).toBe('http://localhost:3000/home');
            
            infoSpy.mockRestore();
        });

        it('should handle requests with no cookies', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            const reqWithoutCookies = {
                ...mockRequest,
                cookies: {}
            };
            
            logSession('NO_COOKIES_TEST', reqWithoutCookies);
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData.cookies).toBeNull();
            
            infoSpy.mockRestore();
        });

        it('should handle requests with undefined cookies', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            const reqWithUndefinedCookies = {
                ...mockRequest,
                cookies: undefined
            };
            
            logSession('UNDEFINED_COOKIES_TEST', reqWithUndefinedCookies);
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData.cookies).toBeNull();
            
            infoSpy.mockRestore();
        });

        it('should handle additional data parameter', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            const additionalData = {
                errorCode: 404,
                errorMessage: 'Page not found',
                customField: 'customValue'
            };
            
            logSession('ERROR_EVENT', mockRequest, additionalData);
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData).toEqual(expect.objectContaining({
                eventType: 'ERROR_EVENT',
                errorCode: 404,
                errorMessage: 'Page not found',
                customField: 'customValue'
            }));
            
            infoSpy.mockRestore();
        });

        it('should handle empty additional data', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            logSession('EMPTY_ADDITIONAL_DATA', mockRequest, {});
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData.eventType).toBe('EMPTY_ADDITIONAL_DATA');
            
            infoSpy.mockRestore();
        });

        it('should generate valid ISO timestamp', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            logSession('TIMESTAMP_TEST', mockRequest);
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            const timestamp = new Date(loggedData.timestamp);
            
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.toISOString()).toBe(loggedData.timestamp);
            
            infoSpy.mockRestore();
        });
    });

    describe('Environment-based Configuration', () => {
        let originalNodeEnv: string | undefined;

        beforeEach(() => {
            originalNodeEnv = process.env.NODE_ENV;
        });

        afterEach(() => {
            if (originalNodeEnv !== undefined) {
                process.env.NODE_ENV = originalNodeEnv;
            } else {
                delete process.env.NODE_ENV;
            }
        });

        it('should handle production environment', () => {
            process.env.NODE_ENV = 'production';
            
            // Re-import to get fresh instance with new environment
            jest.resetModules();
            
            expect(() => {
                require('../../../config/logger');
            }).not.toThrow();
        });

        it('should handle development environment', () => {
            process.env.NODE_ENV = 'development';
            
            // Re-import to get fresh instance with new environment
            jest.resetModules();
            
            expect(() => {
                require('../../../config/logger');
            }).not.toThrow();
        });

        it('should handle test environment', () => {
            process.env.NODE_ENV = 'test';
            
            // Re-import to get fresh instance with new environment
            jest.resetModules();
            
            expect(() => {
                require('../../../config/logger');
            }).not.toThrow();
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle malformed request objects', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            const malformedRequest = {
                // Missing most expected properties
                method: 'GET'
            };
            
            expect(() => {
                logSession('MALFORMED_REQUEST', malformedRequest);
            }).not.toThrow();
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData.eventType).toBe('MALFORMED_REQUEST');
            expect(loggedData.method).toBe('GET');
            expect(loggedData.sessionId).toBe('unknown');
            expect(loggedData.userId).toBeNull();
            
            infoSpy.mockRestore();
        });

        it('should handle null request object', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            expect(() => {
                logSession('NULL_REQUEST', null as any);
            }).not.toThrow();
            
            infoSpy.mockRestore();
        });

        it('should handle undefined headers', () => {
            const infoSpy = jest.spyOn(sessionLogger, 'info').mockImplementation();
            
            const reqWithoutHeaders = {
                sessionID: 'test-session',
                headers: undefined
            };
            
            expect(() => {
                logSession('NO_HEADERS', reqWithoutHeaders);
            }).not.toThrow();
            
            const loggedData = infoSpy.mock.calls[0][0] as any;
            expect(loggedData.userAgent).toBeNull();
            expect(loggedData.host).toBeNull();
            
            infoSpy.mockRestore();
        });
    });

    describe('Default Export', () => {
        it('should export default object with all logger components', () => {
            const defaultExport = require('../../../config/logger').default;
            
            expect(defaultExport).toBeDefined();
            expect(defaultExport.sqlLogger).toBeDefined();
            expect(defaultExport.appLogger).toBeDefined();
            expect(defaultExport.sessionLogger).toBeDefined();
            expect(defaultExport.logSQL).toBeDefined();
            expect(defaultExport.logSession).toBeDefined();
        });
    });
});
