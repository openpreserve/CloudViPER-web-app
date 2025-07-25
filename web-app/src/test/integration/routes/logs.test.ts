import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import fs from 'fs';
import path from 'path';

// Mock file system operations
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path operations
jest.mock('path');
const mockPath = path as jest.Mocked<typeof path>;

describe('Log Service Integration Tests', () => {
    let app: express.Application;
    
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Create Express app with basic setup
        app = express();
        app.use(express.json());
        app.use(session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: false
        }));

        // Mock user middleware for admin access
        app.use((req, res, next) => {
            req.user = { 
                id: 1, 
                email: 'admin@example.com', 
                role: 'admin' 
            };
            next();
        });

        // Import routes after setting up mocks
        const serviceRoutes = require('../../../routes/service');
        app.use('/service', serviceRoutes);
    });

    describe('GET /service/logs/dates', () => {
        it('should return available log dates for admin users', async () => {
            // Mock readdir to return sample log files
            mockFs.readdir.mockImplementation((dirPath, callback: any) => {
                callback(null, [
                    'session-2025-07-25.log',
                    'session-2025-07-24.log',
                    'app-2025-07-25.log',
                    'app-2025-07-24.log',
                    'sql-2025-07-25.log',
                    'other-file.txt'
                ]);
            });

            // Mock path.join to return expected path
            mockPath.join.mockReturnValue('/logs/path');

            const response = await request(app)
                .get('/service/logs/dates')
                .expect(200);

            expect(response.body).toHaveProperty('dates');
            expect(Array.isArray(response.body.dates)).toBe(true);
            expect(response.body.dates).toContain('2025-07-25');
            expect(response.body.dates).toContain('2025-07-24');
        });

        it('should handle readdir errors gracefully', async () => {
            mockFs.readdir.mockImplementation((dirPath, callback: any) => {
                callback(new Error('Directory not found'), null);
            });

            const response = await request(app)
                .get('/service/logs/dates')
                .expect(500);

            expect(response.body).toHaveProperty('error');
        });

        it('should deny access to non-admin users', async () => {
            // Override middleware to simulate non-admin user
            app.use((req, res, next) => {
                req.user = { 
                    id: 2, 
                    email: 'user@example.com', 
                    role: 'user' 
                };
                next();
            });

            const response = await request(app)
                .get('/service/logs/dates')
                .expect(403);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Admin access required');
        });
    });

    describe('GET /service/logs/:type', () => {
        beforeEach(() => {
            // Mock fs.createReadStream for log file reading
            const mockStream = {
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        // Simulate log file content
                        callback('{"timestamp":"2025-07-25T10:00:00Z","message":"Test log entry","level":"info"}\n');
                    } else if (event === 'end') {
                        callback();
                    }
                    return mockStream;
                }),
                pipe: jest.fn()
            };
            mockFs.createReadStream.mockReturnValue(mockStream as any);
        });

        it('should return session logs with pagination', async () => {
            const response = await request(app)
                .get('/service/logs/session')
                .query({ date: '2025-07-25', limit: 10, offset: 0 })
                .expect(200);

            expect(response.body).toHaveProperty('logs');
            expect(response.body).toHaveProperty('total');
            expect(response.body).toHaveProperty('hasMore');
            expect(Array.isArray(response.body.logs)).toBe(true);
        });

        it('should return application logs with pagination', async () => {
            const response = await request(app)
                .get('/service/logs/app')
                .query({ date: '2025-07-25', limit: 10, offset: 0 })
                .expect(200);

            expect(response.body).toHaveProperty('logs');
            expect(response.body).toHaveProperty('total');
            expect(response.body).toHaveProperty('hasMore');
        });

        it('should return SQL logs with pagination', async () => {
            const response = await request(app)
                .get('/service/logs/sql')
                .query({ date: '2025-07-25', limit: 10, offset: 0 })
                .expect(200);

            expect(response.body).toHaveProperty('logs');
            expect(response.body).toHaveProperty('total');
            expect(response.body).toHaveProperty('hasMore');
        });

        it('should handle invalid log type', async () => {
            const response = await request(app)
                .get('/service/logs/invalid')
                .query({ date: '2025-07-25' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Invalid log type');
        });

        it('should handle missing date parameter', async () => {
            const response = await request(app)
                .get('/service/logs/session')
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Date parameter is required');
        });

        it('should handle non-existent log files', async () => {
            mockFs.createReadStream.mockImplementation(() => {
                const errorStream = new (require('events').EventEmitter)();
                setTimeout(() => errorStream.emit('error', new Error('File not found')), 0);
                return errorStream as any;
            });

            const response = await request(app)
                .get('/service/logs/session')
                .query({ date: '2025-07-25' })
                .expect(200); // Should still return 200 with empty logs

            expect(response.body.logs).toEqual([]);
            expect(response.body.total).toBe(0);
        });

        it('should apply correct pagination limits', async () => {
            const response = await request(app)
                .get('/service/logs/session')
                .query({ date: '2025-07-25', limit: 5, offset: 10 })
                .expect(200);

            expect(response.body).toHaveProperty('logs');
            expect(response.body).toHaveProperty('total');
            expect(response.body).toHaveProperty('hasMore');
        });

        it('should deny access to non-admin users', async () => {
            // Override middleware to simulate non-admin user
            app.use((req, res, next) => {
                req.user = { 
                    id: 2, 
                    email: 'user@example.com', 
                    role: 'user' 
                };
                next();
            });

            const response = await request(app)
                .get('/service/logs/session')
                .query({ date: '2025-07-25' })
                .expect(403);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Admin access required');
        });
    });

    describe('Log Content Parsing', () => {
        it('should correctly parse JSON log entries', async () => {
            const mockLogContent = [
                '{"timestamp":"2025-07-25T10:00:00Z","message":"User login","eventType":"User Login","userId":1}',
                '{"timestamp":"2025-07-25T10:01:00Z","message":"Role change","eventType":"Role Change","oldRole":"user","newRole":"admin"}',
                'Invalid JSON line',
                '{"timestamp":"2025-07-25T10:02:00Z","message":"Container created","containerId":"abc123"}'
            ].join('\n');

            const mockStream = {
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        callback(mockLogContent);
                    } else if (event === 'end') {
                        callback();
                    }
                    return mockStream;
                }),
                pipe: jest.fn()
            };
            mockFs.createReadStream.mockReturnValue(mockStream as any);

            const response = await request(app)
                .get('/service/logs/app')
                .query({ date: '2025-07-25' })
                .expect(200);

            expect(response.body.logs).toHaveLength(3); // Should skip invalid JSON
            expect(response.body.logs[0]).toHaveProperty('eventType', 'User Login');
            expect(response.body.logs[1]).toHaveProperty('eventType', 'Role Change');
            expect(response.body.logs[2]).toHaveProperty('containerId', 'abc123');
        });

        it('should handle SQL log format correctly', async () => {
            const mockSqlContent = [
                '2025-07-25 10:00:00 - SELECT * FROM users WHERE id = 1',
                '2025-07-25 10:01:00 - INSERT INTO logs (message) VALUES ("test")',
                '2025-07-25 10:02:00 - UPDATE users SET role = "admin" WHERE id = 1'
            ].join('\n');

            const mockStream = {
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        callback(mockSqlContent);
                    } else if (event === 'end') {
                        callback();
                    }
                    return mockStream;
                }),
                pipe: jest.fn()
            };
            mockFs.createReadStream.mockReturnValue(mockStream as any);

            const response = await request(app)
                .get('/service/logs/sql')
                .query({ date: '2025-07-25' })
                .expect(200);

            expect(response.body.logs).toHaveLength(3);
            expect(response.body.logs[0]).toHaveProperty('content');
            expect(response.body.logs[0]).toHaveProperty('lineNumber', 1);
            expect(response.body.logs[0].content).toContain('SELECT * FROM users');
        });
    });
});
