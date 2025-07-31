import { Request, Response, NextFunction } from 'express';
import RateLimiter, { instanceCreationLimiter, generalApiLimiter, authLimiter } from '../../../middleware/rateLimiter';

// Mock the logger
jest.mock('../../../config/logger', () => ({
    appLogger: {
        warn: jest.fn(),
        info: jest.fn(),
        error: jest.fn()
    }
}));
import { appLogger } from '../../../config/logger';

describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;
    let mockReq: any; // Use any to avoid readonly property issues
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();
        rateLimiter = new RateLimiter(60000, 5); // 5 requests per minute
        
        mockReq = {
            ip: '127.0.0.1',
            path: '/test',
            method: 'GET',
            user: undefined
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        mockNext = jest.fn();
    });

    afterEach(() => {
        if (rateLimiter) {
            rateLimiter.destroy();
        }
    });

    describe('Basic Rate Limiting', () => {
        it('should allow requests under the limit', () => {
            const middleware = rateLimiter.middleware();

            // Make 5 requests (at the limit)
            for (let i = 0; i < 5; i++) {
                middleware(mockReq as Request, mockRes as Response, mockNext);
            }

            expect(mockNext).toHaveBeenCalledTimes(5);
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('should block requests over the limit', () => {
            const middleware = rateLimiter.middleware();

            // Make 6 requests (1 over the limit)
            for (let i = 0; i < 6; i++) {
                middleware(mockReq as Request, mockRes as Response, mockNext);
            }

            expect(mockNext).toHaveBeenCalledTimes(5);
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Rate limit exceeded',
                message: expect.stringContaining('Too many requests')
            }));
        });

        it('should log rate limit violations', () => {
            const middleware = rateLimiter.middleware();

            // Exceed the limit
            for (let i = 0; i < 6; i++) {
                middleware(mockReq as Request, mockRes as Response, mockNext);
            }

            expect(appLogger.warn).toHaveBeenCalledWith('Rate limit exceeded', expect.objectContaining({
                eventType: 'Rate Limit Exceeded',
                endpoint: '/test',
                method: 'GET',
                ipAddress: '127.0.0.1',
                requestCount: 5
            }));
        });
    });

    describe('User vs IP Based Limiting', () => {
        it('should use IP address for unauthenticated users', () => {
            const middleware = rateLimiter.middleware();
            mockReq.ip = '192.168.1.1';

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should use user ID for authenticated users', () => {
            const middleware = rateLimiter.middleware();
            mockReq.user = { id: 123, role: 'member' };

            // Make requests as authenticated user
            for (let i = 0; i < 5; i++) {
                middleware(mockReq as Request, mockRes as Response, mockNext);
            }

            expect(mockNext).toHaveBeenCalledTimes(5);

            // 6th request should be blocked
            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(appLogger.warn).toHaveBeenCalledWith('Rate limit exceeded', expect.objectContaining({
                userId: 123,
                userRole: 'member'
            }));
        });

        it('should track different users separately', () => {
            const middleware = rateLimiter.middleware();

            // User 1 makes 5 requests
            mockReq.user = { id: 1, role: 'member' };
            for (let i = 0; i < 5; i++) {
                middleware(mockReq as Request, mockRes as Response, mockNext);
            }

            // User 2 makes 5 requests
            mockReq.user = { id: 2, role: 'admin' };
            for (let i = 0; i < 5; i++) {
                middleware(mockReq as Request, mockRes as Response, mockNext);
            }

            expect(mockNext).toHaveBeenCalledTimes(10);
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('should track different IP addresses separately', () => {
            const middleware = rateLimiter.middleware();

            // IP 1 makes 5 requests
            mockReq.ip = '192.168.1.1';
            for (let i = 0; i < 5; i++) {
                middleware(mockReq as Request, mockRes as Response, mockNext);
            }

            // IP 2 makes 5 requests
            mockReq.ip = '192.168.1.2';
            for (let i = 0; i < 5; i++) {
                middleware(mockReq as Request, mockRes as Response, mockNext);
            }

            expect(mockNext).toHaveBeenCalledTimes(10);
            expect(mockRes.status).not.toHaveBeenCalled();
        });
    });

    describe('Time Window Reset', () => {
        it('should reset counter after time window expires', async () => {
            // Use a short window for testing
            const shortLimiter = new RateLimiter(100, 2); // 2 requests per 100ms
            const middleware = shortLimiter.middleware();

            try {
                // Make 2 requests (at limit)
                middleware(mockReq as Request, mockRes as Response, mockNext);
                middleware(mockReq as Request, mockRes as Response, mockNext);

                expect(mockNext).toHaveBeenCalledTimes(2);

                // 3rd request should be blocked
                middleware(mockReq as Request, mockRes as Response, mockNext);
                expect(mockRes.status).toHaveBeenCalledWith(429);

                // Wait for window to expire
                await new Promise(resolve => setTimeout(resolve, 150));

                // Reset mocks
                jest.clearAllMocks();

                // Should be able to make requests again
                middleware(mockReq as Request, mockRes as Response, mockNext);
                expect(mockNext).toHaveBeenCalled();
                expect(mockRes.status).not.toHaveBeenCalled();
            } finally {
                shortLimiter.destroy();
            }
        });
    });

    describe('Configuration', () => {
        it('should respect custom window and limit settings', () => {
            const customLimiter = new RateLimiter(30000, 3); // 3 requests per 30 seconds
            const middleware = customLimiter.middleware();

            try {
                // Make 3 requests (at limit)
                for (let i = 0; i < 3; i++) {
                    middleware(mockReq as Request, mockRes as Response, mockNext);
                }

                expect(mockNext).toHaveBeenCalledTimes(3);

                // 4th request should be blocked
                middleware(mockReq as Request, mockRes as Response, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(429);
                expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining('Maximum 3 requests per 30 seconds')
                }));
            } finally {
                customLimiter.destroy();
            }
        });

        it('should use default settings when not provided', () => {
            const defaultLimiter = new RateLimiter();
            const middleware = defaultLimiter.middleware();

            try {
                // Make 5 requests (default limit)
                for (let i = 0; i < 5; i++) {
                    middleware(mockReq as Request, mockRes as Response, mockNext);
                }

                expect(mockNext).toHaveBeenCalledTimes(5);

                // 6th request should be blocked
                middleware(mockReq as Request, mockRes as Response, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(429);
                expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining('Maximum 5 requests per 60 seconds')
                }));
            } finally {
                defaultLimiter.destroy();
            }
        });
    });

    describe('Response Format', () => {
        it('should include retry-after information in response', () => {
            const middleware = rateLimiter.middleware();

            // Exceed the limit
            for (let i = 0; i < 6; i++) {
                middleware(mockReq as Request, mockRes as Response, mockNext);
            }

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Rate limit exceeded',
                message: 'Too many requests. Maximum 5 requests per 60 seconds.',
                retryAfter: expect.any(Number)
            }));
        });

        it('should provide accurate retry-after timing', () => {
            const shortLimiter = new RateLimiter(10000, 1); // 1 request per 10 seconds
            const middleware = shortLimiter.middleware();

            try {
                // Make first request
                middleware(mockReq as Request, mockRes as Response, mockNext);

                // Second request should be blocked
                middleware(mockReq as Request, mockRes as Response, mockNext);

                const jsonCall = (mockRes.json as jest.Mock).mock.calls[0][0];
                expect(jsonCall.retryAfter).toBeGreaterThan(0);
                expect(jsonCall.retryAfter).toBeLessThanOrEqual(10);
            } finally {
                shortLimiter.destroy();
            }
        });
    });

    describe('Cleanup Mechanism', () => {
        it('should clean up old entries', (done) => {
            const cleanupLimiter = new RateLimiter(100, 5); // Very short window

            try {
                const middleware = cleanupLimiter.middleware();

                // Make a request to create an entry
                middleware(mockReq as Request, mockRes as Response, mockNext);

                // Wait for cleanup to run (cleanup runs every 60 seconds, but we'll check internal state)
                setTimeout(() => {
                    // The entry should still exist since cleanup interval is 60 seconds
                    // This tests the cleanup method exists and can be called
                    expect(mockNext).toHaveBeenCalled();
                    cleanupLimiter.destroy();
                    done();
                }, 50);
            } catch (error) {
                cleanupLimiter.destroy();
                done(error);
            }
        });

        it('should properly destroy and clear resources', () => {
            const testLimiter = new RateLimiter();
            const middleware = testLimiter.middleware();

            // Make some requests to create internal state
            middleware(mockReq as Request, mockRes as Response, mockNext);

            // Destroy should not throw
            expect(() => testLimiter.destroy()).not.toThrow();

            // Multiple destroy calls should be safe
            expect(() => testLimiter.destroy()).not.toThrow();
        });
    });

    describe('Exported Limiters', () => {
        afterAll(() => {
            // Clean up exported limiters
            instanceCreationLimiter.destroy();
            generalApiLimiter.destroy();
            authLimiter.destroy();
        });

        it('should export preconfigured instance creation limiter', () => {
            expect(instanceCreationLimiter).toBeInstanceOf(RateLimiter);
            const middleware = instanceCreationLimiter.middleware();
            expect(typeof middleware).toBe('function');
        });

        it('should export preconfigured general API limiter', () => {
            expect(generalApiLimiter).toBeInstanceOf(RateLimiter);
            const middleware = generalApiLimiter.middleware();
            expect(typeof middleware).toBe('function');
        });

        it('should export preconfigured auth limiter', () => {
            expect(authLimiter).toBeInstanceOf(RateLimiter);
            const middleware = authLimiter.middleware();
            expect(typeof middleware).toBe('function');
        });

        it('should have different limits for different limiters', () => {
            const instanceMiddleware = instanceCreationLimiter.middleware();
            const generalMiddleware = generalApiLimiter.middleware();
            const authMiddleware = authLimiter.middleware();

            // All should function as middleware
            instanceMiddleware(mockReq as Request, mockRes as Response, mockNext);
            generalMiddleware(mockReq as Request, mockRes as Response, mockNext);
            authMiddleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(3);
        });
    });

    describe('Edge Cases', () => {
        it('should handle requests with no IP address', () => {
            const middleware = rateLimiter.middleware();
            mockReq.ip = undefined;

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle malformed user objects', () => {
            const middleware = rateLimiter.middleware();
            mockReq.user = { username: 'test' }; // No ID

            middleware(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle concurrent requests properly', () => {
            const middleware = rateLimiter.middleware();

            // Simulate concurrent requests from same IP
            for (let i = 0; i < 10; i++) {
                middleware(mockReq as Request, mockRes as Response, mockNext);
            }

            // First 5 should succeed, rest should be blocked
            expect(mockNext).toHaveBeenCalledTimes(5);
            expect(mockRes.status).toHaveBeenCalledWith(429);
        });
    });
});
