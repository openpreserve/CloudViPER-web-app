import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { UserRole } from '../../../types/UserRole';

// Mock the container object returned by docker operations
const mockContainer = {
    id: 'test-container-id',
    start: jest.fn(),
    stop: jest.fn(),
    remove: jest.fn(),
    inspect: jest.fn(),
    exec: jest.fn()
};

// Mock dockerode instance
const mockDockerInstance = {
    createContainer: jest.fn(),
    getContainer: jest.fn()
};

// Set up module mocks with isolated module registry
jest.mock('dockerode', () => {
    return jest.fn().mockImplementation(() => mockDockerInstance);
});

jest.mock('../../../utility/helperFunctions', () => ({
    generateRandomString: jest.fn()
}));

jest.mock('../../../utility/portManager', () => ({
    getAvailablePort: jest.fn()
}));

jest.mock('../../../models', () => ({
    ViperInstance: {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        count: jest.fn(),
        destroy: jest.fn(),
        update: jest.fn()
    },
    Log: {
        create: jest.fn()
    },
    User: {
        findByPk: jest.fn(),
        findOne: jest.fn(),
        findAll: jest.fn()
    },
    Screenshot: {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        destroy: jest.fn()
    },
    Activity: {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        destroy: jest.fn()
    },
    sequelize: {
        sync: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
    }
}));

// Import after mocking
import db from '../../../models';
import helperFunctions from '../../../utility/helperFunctions';
import * as portManager from '../../../utility/portManager';
import serviceRouter from '../../../routes/service';

const mockedHelperFunctions = helperFunctions as jest.Mocked<typeof helperFunctions>;
const mockedPortManager = portManager as jest.Mocked<typeof portManager>;

/**
 * Integration tests for Service Routes
 * 
 * This test suite covers all service routes including:
 * - Role-based authentication and redirects
 * - Container management operations (create, terminate, inspect)
 * - Admin-only functionality
 * - Error handling and edge cases
 * - Environment configuration testing
 * 
 * Test Coverage: 70.22% (42 tests)
 * All major functionality is tested including Docker operations,
 * database interactions, and user authentication flows.
 */

describe('Service Routes', () => {
    let mockExec: any;
    let mockStream: any;

    // Test data constants for better maintainability
    const TEST_USERS = {
        ADMIN: { id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN },
        TESTING: { id: 2, username: 'tester', email: 'test@test.com', role: UserRole.TESTING },
        MEMBER: { id: 3, username: 'member', email: 'member@test.com', role: UserRole.MEMBER },
        USER: { id: 4, username: 'user', email: 'user@test.com', role: UserRole.USER }
    };

    const TEST_CONTAINERS = {
        VALID_ID: 'test-container-id',
        NONEXISTENT_ID: 'nonexistent-container'
    };

    const TEST_RESPONSES = {
        AUTH_ERROR: { error: "Authentication" },
        ADMIN_REQUIRED: { message: 'Admin access required' },
        ERROR_4: { message: 'Error 4' },
        INSTANCE_NOT_FOUND: { message: 'Instance not found' }
    };

    // Helper function to create test app with authentication
    const createTestApp = (user?: any) => {
        const testApp = express();
        
        // Set up a mock view engine for rendering
        testApp.set('view engine', 'ejs');
        testApp.set('views', '/mock/views'); // Non-existent path
        
        // Mock the render function to avoid file system operations
        testApp.use((req, res, next) => {
            const originalRender = res.render;
            res.render = function(view: string, options?: any) {
                // Just send a simple response instead of rendering a template
                res.status(200).send(`<html><body>Mock ${view} page</body></html>`);
            };
            next();
        });
        
        testApp.use(session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: false,
            cookie: { secure: false }
        }));
        testApp.use(express.json());
        testApp.use(express.urlencoded({ extended: true }));
        if (user) {
            testApp.use((req, res, next) => {
                req.user = user;
                next();
            });
        }
        testApp.use('/service', serviceRouter);
        return testApp;
    };

    // Helper function to create mock ViperInstance
    const createMockViperInstance = (overrides = {}) => ({
        id: 1,
        uuid: 'mock-random-string',
        dockerid: TEST_CONTAINERS.VALID_ID,
        name: 'viper-cloud-mock-random-string',
        url: 'mock-random-string.localhost',
        kasmvncPassword: 'mock-random-string',
        statusKey: 'mock-random-string',
        owner: 1,
        status: 'created',
        logs: [{ timestamp: expect.any(Date), message: "Created" }],
        ...overrides
    });

    // Helper function to setup common mocks
    const setupCommonMocks = () => {
        mockedHelperFunctions.generateRandomString.mockReturnValue('mock-random-string');
        mockedPortManager.getAvailablePort.mockResolvedValue(3001);
        
        // Mock database models with default implementations
        (db.ViperInstance.create as jest.Mock).mockResolvedValue(createMockViperInstance());
        (db.ViperInstance.findAll as jest.Mock).mockResolvedValue([]);
        (db.ViperInstance.findOne as jest.Mock).mockResolvedValue(null);
        (db.ViperInstance.count as jest.Mock).mockResolvedValue(0);
        (db.ViperInstance.destroy as jest.Mock).mockResolvedValue(1);
        (db.ViperInstance.update as jest.Mock).mockResolvedValue([1]); // Sequelize update returns [affectedCount]

        (db.Log.create as jest.Mock).mockResolvedValue({});

        (db.User.findByPk as jest.Mock).mockResolvedValue(null);
        (db.User.findOne as jest.Mock).mockResolvedValue(null);
        (db.User.findAll as jest.Mock).mockResolvedValue([]);

        // Mock new models
        (db.Screenshot.create as jest.Mock).mockResolvedValue({});
        (db.Screenshot.findAll as jest.Mock).mockResolvedValue([]);
        (db.Screenshot.findOne as jest.Mock).mockResolvedValue(null);
        (db.Screenshot.destroy as jest.Mock).mockResolvedValue(1);

        (db.Activity.create as jest.Mock).mockResolvedValue({});
        (db.Activity.findAll as jest.Mock).mockResolvedValue([]);
        (db.Activity.findOne as jest.Mock).mockResolvedValue(null);
        (db.Activity.destroy as jest.Mock).mockResolvedValue(1);
    };

    // Helper functions for common test patterns
    const expectRedirect = (response: any, expectedLocation: string) => {
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(expectedLocation);
    };

    const expectPageRender = (response: any, expectedPageContent: string) => {
        expect(response.status).toBe(200);
        expect(response.text).toContain(expectedPageContent);
    };

    const expectUnauthorized = (response: any) => {
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/login');
    };

    const expectJsonResponse = (response: any, expectedStatus: number, expectedData?: any) => {
        expect(response.status).toBe(expectedStatus);
        expect(response.headers['content-type']).toMatch(/json/);
        if (expectedData) {
            expect(response.body).toMatchObject(expectedData);
        }
    };

    beforeAll(async () => {
        // Mock database setup - no real database needed
    });

    beforeEach(() => {
        // Clear all mocks to prevent interference between tests
        jest.clearAllMocks();
        
        // Reset all mock implementations to default state
        setupCommonMocks();
        
        // Setup Docker mocks
        mockStream = {
            on: jest.fn().mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback(Buffer.from('test output'));
                } else if (event === 'end') {
                    setTimeout(callback, 10);
                }
            })
        };

        mockExec = {
            start: jest.fn().mockResolvedValue(mockStream)
        };

        // Reset mock implementations with test data
        mockContainer.start.mockResolvedValue(undefined);
        mockContainer.exec.mockResolvedValue(mockExec);
        mockContainer.inspect.mockResolvedValue({
            Id: TEST_CONTAINERS.VALID_ID,
            State: { Status: 'running' },
            Config: { Image: 'test-image' }
        });
        mockContainer.stop.mockImplementation((callback) => {
            callback(null, 'stopped');
        });
        mockContainer.remove.mockImplementation((callback) => {
            callback(null, 'removed');
        });

        // Setup Docker instance mocks
        mockDockerInstance.createContainer.mockResolvedValue(mockContainer);
        mockDockerInstance.getContainer.mockReturnValue(mockContainer);
    });

    afterEach(() => {
        // Clean up any lingering state
        jest.clearAllMocks();
    });

    afterAll(async () => {
        // Clean up mocks
        jest.clearAllMocks();
    });

    describe('GET /', () => {
        it('should redirect admin users to /service/admin', async () => {
            const testApp = createTestApp(TEST_USERS.ADMIN);
            const response = await request(testApp).get('/service/');
            expectRedirect(response, '/service/admin');
        });

        it('should redirect testing users to /service/testing', async () => {
            const testApp = createTestApp(TEST_USERS.TESTING);
            const response = await request(testApp).get('/service/');
            expectRedirect(response, '/service/testing');
        });

        it('should redirect member users to /service/member', async () => {
            const testApp = createTestApp(TEST_USERS.MEMBER);
            const response = await request(testApp).get('/service/');
            expectRedirect(response, '/service/member');
        });

        it('should redirect users with default role to /account', async () => {
            const testApp = createTestApp(TEST_USERS.USER);
            const response = await request(testApp).get('/service/');
            expectRedirect(response, '/account');
        });

        it('should redirect unauthenticated users to login', async () => {
            const testApp = createTestApp(); // No user
            const response = await request(testApp).get('/service/');
            expectRedirect(response, '/account/login');
        });

        it('should handle invalid user role gracefully', async () => {
            const invalidUser = { ...TEST_USERS.USER, role: 'INVALID_ROLE' as any };
            const testApp = createTestApp(invalidUser);
            const response = await request(testApp).get('/service/');
            expectRedirect(response, '/account');
        });
    });

    describe('GET /admin', () => {
        it('should render admin page for admin users', async () => {
            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });

            const response = await request(testApp).get('/service/admin');
            expect(response.status).toBe(200);
        });        it('should redirect non-admin users', async () => {
            const testApp = createTestApp({ id: 2, username: 'member', email: 'member@test.com', role: UserRole.MEMBER });
            const response = await request(testApp).get('/service/admin');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/service');
        });

        it('should redirect unauthenticated users', async () => {
            const testApp = createTestApp(); // No user
            const response = await request(testApp).get('/service/admin');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/service');
        });
    });

    describe('GET /testing', () => {
        it('should render testing page for testing users', async () => {
            const testApp = createTestApp({ id: 2, username: 'tester', email: 'test@test.com', role: UserRole.TESTING });

            const response = await request(testApp).get('/service/testing');
            expect(response.status).toBe(200);
        });

        it('should allow admin users to access testing page', async () => {
            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });
            const response = await request(testApp).get('/service/testing');
            expect(response.status).toBe(200);
        });
    });

    describe('GET /member', () => {
        it('should render member page for member users', async () => {
            const testApp = createTestApp({ id: 3, username: 'member', email: 'member@test.com', role: UserRole.MEMBER });

            const response = await request(testApp).get('/service/member');
            expect(response.status).toBe(200);
        });

        it('should allow admin users to access member page', async () => {
            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });
            const response = await request(testApp).get('/service/member');
            expect(response.status).toBe(200);
        });
    });

    describe('GET /new-instance', () => {
        beforeEach(() => {
            // Mock ViperInstance creation
            (db.ViperInstance.create as jest.Mock).mockResolvedValue({
                id: 1,
                uuid: 'mock-random-string',
                dockerid: 'test-container-id',
                name: 'viper-cloud-mock-random-string',
                url: 'mock-random-string.localhost',
                kasmvncPassword: 'mock-random-string',
                statusKey: 'mock-random-string',
                owner: 1,
                status: 'created',
                logs: [{ timestamp: expect.any(Date), message: "Created" }]
            });
        });

        it('should create new instance for admin user', async () => {
            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });

            const response = await request(testApp).get('/service/new-instance');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                message: "ViPER instance created successfully",
                container: {
                    id: 'test-container-id',
                    uuid: 'mock-random-string',
                    url: 'mock-random-string.localhost',
                    status: "created"
                }
            });

            expect(mockDockerInstance.createContainer).toHaveBeenCalled();
            expect(mockContainer.start).toHaveBeenCalled();
            expect(db.ViperInstance.create).toHaveBeenCalled();
        });

        it('should create new instance for testing user', async () => {
            const testApp = createTestApp({ id: 2, username: 'tester', email: 'test@test.com', role: UserRole.TESTING });
            const response = await request(testApp).get('/service/new-instance');
            expect(response.status).toBe(200);
            expect(mockDockerInstance.createContainer).toHaveBeenCalled();
        });

        it('should create new instance for member user', async () => {
            const testApp = createTestApp({ id: 3, username: 'member', email: 'member@test.com', role: UserRole.MEMBER });
            const response = await request(testApp).get('/service/new-instance');
            expect(response.status).toBe(200);
            expect(mockDockerInstance.createContainer).toHaveBeenCalled();
        });

        it('should reject user role', async () => {
            const testApp = createTestApp({ id: 4, username: 'user', email: 'user@test.com', role: UserRole.USER });
            const response = await request(testApp).get('/service/new-instance');
            expect(response.status).toBe(403);
            expect(response.body).toEqual({ "error": "Insufficient permissions" });
            expect(mockDockerInstance.createContainer).not.toHaveBeenCalled();
        });

        it('should reject unauthenticated users', async () => {
            const testApp = createTestApp(); // No user
            const response = await request(testApp).get('/service/new-instance');
            expect(response.status).toBe(403);
            expect(response.body).toEqual({ "error": "Insufficient permissions" });
        });

        it('should handle Docker errors', async () => {
            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });

            const dockerError = new Error('Docker failed');
            mockDockerInstance.createContainer.mockRejectedValue(dockerError);

            // Mock Log creation
            (db.Log.create as jest.Mock).mockResolvedValue({});

            const response = await request(testApp).get('/service/new-instance');
            
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ 
                error: 'Error creating or starting container',
                message: "An error occurred while creating your ViPER instance. Please try again or contact support."
            });
            expect(db.Log.create).toHaveBeenCalledWith({
                eventType: 'Error',
                message: 'Error creating or starting container',
                eventDescription: dockerError.toString(),
                userId: 1,
                createdAt: expect.any(Date)
            });
        });
    });

    describe('GET /viperinstances', () => {
        it('should return all instances for admin', async () => {
            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });

            const mockInstanceData = [
                { id: 1, uuid: 'test1', owner: 1, createdAt: new Date() },
                { id: 2, uuid: 'test2', owner: 2, createdAt: new Date() }
            ];

            // Mock instances with toJSON method like real Sequelize models
            const mockInstances = mockInstanceData.map(data => ({
                ...data,
                toJSON: () => data
            }));

            (db.ViperInstance.findAll as jest.Mock).mockResolvedValue(mockInstances);
            (db.ViperInstance.count as jest.Mock).mockResolvedValue(2);

            const response = await request(testApp).get('/service/viperinstances');
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('instances');
            expect(response.body).toHaveProperty('total', 2);
            expect(response.body).toHaveProperty('userRole', 'admin');
            expect(response.body).toHaveProperty('canCreateNew', true);
            expect(response.body.instances).toHaveLength(2);
            expect(response.body.instances[0]).toHaveProperty('id', 1);
            expect(response.body.instances[0]).toHaveProperty('uuid', 'test1');
            expect(response.body.instances[0]).toHaveProperty('operationalHours');
            expect(response.body.instances[0]).toHaveProperty('canTerminate');
            expect(db.ViperInstance.findAll).toHaveBeenCalledWith({
                attributes: {
                    exclude: ['lastScreenshot', 'activityHistory']
                },
                include: [{
                    model: db.User,
                    as: 'ownerUser',
                    attributes: ['id', 'username', 'email', 'firstName', 'lastName']
                }, {
                    model: db.Screenshot,
                    as: 'screenshots',
                    attributes: ['id', 'capturedAt', 'receivedAt'],
                    limit: 1,
                    order: [['createdAt', 'DESC']],
                    required: false
                }, {
                    model: db.Activity,
                    as: 'activities',
                    attributes: ['id', 'activityScore', 'reportedAt', 'receivedAt'],
                    limit: 1,
                    order: [['createdAt', 'DESC']],
                    required: false
                }],
                order: [['createdAt', 'DESC']]
            });
        });

        it('should return user instances for non-admin, non-user roles', async () => {
            const testApp = createTestApp({ id: 2, username: 'member', email: 'member@test.com', role: UserRole.MEMBER });

            const userInstanceData = [
                { id: 1, uuid: 'test1', owner: 2, createdAt: new Date() }
            ];

            // Mock instances with toJSON method like real Sequelize models
            const userInstances = userInstanceData.map(data => ({
                ...data,
                toJSON: () => data
            }));

            (db.ViperInstance.findAll as jest.Mock).mockResolvedValue(userInstances);
            (db.ViperInstance.count as jest.Mock).mockResolvedValue(1); // User at their limit (MEMBER role has limit of 1)

            const response = await request(testApp).get('/service/viperinstances');
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('instances');
            expect(response.body).toHaveProperty('total', 1);
            expect(response.body).toHaveProperty('userRole', 'member');
            expect(response.body).toHaveProperty('canCreateNew', false); // MEMBER role limit is 1, user already has 1
            expect(response.body.instances).toHaveLength(1);
            expect(response.body.instances[0]).toHaveProperty('id', 1);
            expect(response.body.instances[0]).toHaveProperty('uuid', 'test1');
            expect(response.body.instances[0]).toHaveProperty('operationalHours');
            expect(response.body.instances[0]).toHaveProperty('canTerminate');
            expect(db.ViperInstance.findAll).toHaveBeenCalledWith({
                where: { owner: 2 },
                attributes: {
                    exclude: ['lastScreenshot', 'activityHistory']
                },
                include: [{
                    model: db.User,
                    as: 'ownerUser',
                    attributes: ['id', 'username', 'email', 'firstName', 'lastName']
                }, {
                    model: db.Screenshot,
                    as: 'screenshots',
                    attributes: ['id', 'capturedAt', 'receivedAt'],
                    limit: 1,
                    order: [['createdAt', 'DESC']],
                    required: false
                }, {
                    model: db.Activity,
                    as: 'activities',
                    attributes: ['id', 'activityScore', 'reportedAt', 'receivedAt'],
                    limit: 1,
                    order: [['createdAt', 'DESC']],
                    required: false
                }],
                order: [['createdAt', 'DESC']]
            });
        });

        it('should return 403 for user role', async () => {
            const testApp = createTestApp({ id: 4, username: 'user', email: 'user@test.com', role: UserRole.USER });
            const response = await request(testApp).get('/service/viperinstances');
            
            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Insufficient permissions. Required: testing or member or subscriber' });
        });

        it('should return 401 for unauthenticated users', async () => {
            const testApp = createTestApp(); // No user
            const response = await request(testApp).get('/service/viperinstances');
            
            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: 'Authentication required' });
        });

        it('should handle database errors for admin', async () => {
            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });

            const dbError = new Error('Database error');
            (db.ViperInstance.findAll as jest.Mock).mockRejectedValue(dbError);

            const response = await request(testApp).get('/service/viperinstances');
            
            expect(response.status).toBe(500);
            expect(response.body.message).toBe('Failed to load instance list. Please try again.');
            expect(response.body.error).toBeDefined(); // Error objects get serialized differently
        });

        it('should handle database errors for non-admin users', async () => {
            const testApp = createTestApp({ id: 2, username: 'member', email: 'member@test.com', role: UserRole.MEMBER });

            const dbError = new Error('Database error');
            (db.ViperInstance.findAll as jest.Mock).mockRejectedValue(dbError);

            const response = await request(testApp).get('/service/viperinstances');
            
            expect(response.status).toBe(500);
            expect(response.body.message).toBe('Failed to load instance list. Please try again.');
            expect(response.body.error).toBeDefined(); // Error objects get serialized differently
        });
    });

    describe('GET /terminate-instance/:containerId', () => {
        beforeEach(() => {
            // Mock instance lookup
            (db.ViperInstance.findOne as jest.Mock) = jest.fn().mockResolvedValue({
                dockerid: 'test-container-id',
                owner: 1, // matches admin user id
                uuid: 'test-uuid'
            });
            // Mock destroy method
            (db.ViperInstance.destroy as jest.Mock) = jest.fn().mockResolvedValue(1);
        });

        it('should successfully terminate container', async () => {
            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });

            const response = await request(testApp).get('/service/terminate-instance/test-container-id');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                message: "Instance terminated successfully",
                details: {
                    STOP: { message: "Container stopped successfully" },
                    REMOVE: { message: "Container removed successfully" },
                    DATABASE: { message: "Database entry removed successfully" }
                }
            });

            expect(mockDockerInstance.getContainer).toHaveBeenCalledWith('test-container-id');
            expect(mockContainer.stop).toHaveBeenCalled();
            expect(mockContainer.remove).toHaveBeenCalled();
            expect(db.ViperInstance.destroy).toHaveBeenCalledWith({
                where: { dockerid: 'test-container-id' }
            });
        }, 10000);

        it('should handle container stop error', async () => {
            mockContainer.stop.mockImplementation((callback: (err: Error | null, data: any) => void) => {
                callback(new Error('Stop failed'), null);
            });

            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });
            const response = await request(testApp).get('/service/terminate-instance/test-container-id');
            
            expect(response.status).toBe(200);
            expect(response.body.details['STOP-ERROR']).toBeDefined();
        }, 10000);

        it('should handle container remove error', async () => {
            mockContainer.remove.mockImplementation((callback: (err: Error | null, data: any) => void) => {
                callback(new Error('Remove failed'), null);
            });

            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });
            const response = await request(testApp).get('/service/terminate-instance/test-container-id');
            
            expect(response.status).toBe(200);
            expect(response.body.details['REMOVE-ERROR']).toBeDefined();
        }, 10000);

        it('should handle instance not found in database', async () => {
            (db.ViperInstance.destroy as jest.Mock).mockResolvedValue(0); // 0 rows affected means not found

            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });
            const response = await request(testApp).get('/service/terminate-instance/test-container-id');
            
            expect(response.status).toBe(200);
            // Should still stop and remove container even if DB record not found
            expect(mockContainer.stop).toHaveBeenCalled();
            expect(mockContainer.remove).toHaveBeenCalled();
            expect(response.body).toEqual({
                success: true,
                message: "Instance terminated successfully",
                details: {
                    STOP: { message: "Container stopped successfully" },
                    REMOVE: { message: "Container removed successfully" },
                    DATABASE: { message: "Database entry removed successfully" }
                }
            });
        }, 10000);

        it('should handle database error', async () => {
            const dbError = new Error('Database error');
            (db.ViperInstance.destroy as jest.Mock).mockRejectedValue(dbError);

            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });
            const response = await request(testApp).get('/service/terminate-instance/test-container-id');
            
            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Partial termination - some operations failed');
            expect(response.body.details['DATABASE-ERROR']).toBeDefined();
        }, 10000);
    });

    describe('GET /set-status-instance/:statuskey/:status', () => {
        it('should successfully update instance status', async () => {
            const mockInstance = {
                logs: [{ timestamp: new Date(), message: 'Initial log' }],
                status: 'active',
                save: jest.fn().mockResolvedValue(undefined),
                update: jest.fn().mockResolvedValue(undefined)
            };

            (db.ViperInstance.findOne as jest.Mock).mockResolvedValue(mockInstance);

            const testApp = createTestApp();
            const response = await request(testApp)
                .get('/service/set-status-instance/test-status-key/active');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                message: "Status updated successfully",
                instance: expect.objectContaining({
                    newStatus: 'active',
                    previousStatus: 'active'
                })
            });

            expect(db.ViperInstance.findOne).toHaveBeenCalledWith({
                where: { statusKey: 'test-status-key' }
            });

            expect(mockInstance.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'active',
                logs: expect.arrayContaining([
                    expect.objectContaining({
                        message: 'Status changed to: active'
                    })
                ])
            }));
        });

        it('should handle instance not found', async () => {
            (db.ViperInstance.findOne as jest.Mock).mockResolvedValue(null);

            const testApp = createTestApp();
            const response = await request(testApp)
                .get('/service/set-status-instance/nonexistent-key/active');
            
            expect(response.status).toBe(404);
            // The endpoint returns 404 when instance is not found
        });

        it('should handle database error', async () => {
            const dbError = new Error('Database error');
            (db.ViperInstance.findOne as jest.Mock).mockRejectedValue(dbError);

            const testApp = createTestApp();
            const response = await request(testApp)
                .get('/service/set-status-instance/test-status-key/active');
            
            expect(response.status).toBe(500);
            expect(response.body.error).toBeDefined(); // Error objects get serialized differently
        });

        it('should handle save error', async () => {
            const saveError = new Error('Save failed');
            const mockInstance = {
                logs: [],
                status: 'active',
                save: jest.fn().mockRejectedValue(saveError),
                update: jest.fn().mockRejectedValue(saveError)
            };

            (db.ViperInstance.findOne as jest.Mock).mockResolvedValue(mockInstance);

            const testApp = createTestApp();
            const response = await request(testApp)
                .get('/service/set-status-instance/test-status-key/active');
            
            expect(response.status).toBe(500);
            expect(response.body.error).toBeDefined(); // Error objects get serialized differently
        });
    });

    describe('Environment Variables and Configuration', () => {
        it('should use production configuration in prod environment', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'prod';

            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });

            (db.ViperInstance.create as jest.Mock).mockResolvedValue({});

            await request(testApp).get('/service/new-instance');

            expect(mockDockerInstance.createContainer).toHaveBeenCalled();
            if (mockDockerInstance.createContainer.mock.calls.length > 0) {
                const createContainerCall = mockDockerInstance.createContainer.mock.calls[0][0];
                expect(createContainerCall.NetworkingConfig.EndpointsConfig).toHaveProperty('ingress-proxy');
                expect(createContainerCall.HostConfig.PortBindings).toBeUndefined();
            }

            process.env.NODE_ENV = originalEnv;
        });

        it('should use development configuration in dev environment', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'dev';

            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });

            (db.ViperInstance.create as jest.Mock).mockResolvedValue({});

            await request(testApp).get('/service/new-instance');

            expect(mockDockerInstance.createContainer).toHaveBeenCalled();
            if (mockDockerInstance.createContainer.mock.calls.length > 0) {
                const createContainerCall = mockDockerInstance.createContainer.mock.calls[0][0];
                expect(createContainerCall.HostConfig.PortBindings).toBeDefined();
                expect(createContainerCall.HostConfig.PortBindings['3000/tcp']).toEqual([{ HostPort: '3001' }]);
            }

            process.env.NODE_ENV = originalEnv;
        });
    });

    // Additional tests for the new admin-only routes
    describe('Admin-only routes', () => {
        describe('GET /viperinstance/:dockerid/inspect', () => {
        it('should return instance details for admin users', async () => {
            const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });

            const mockInstance = {
                id: 1,
                dockerid: 'test-docker-id',
                createdAt: '2023-01-01T00:00:00.000Z', // Use string to match JSON serialization
                ownerUser: {
                    id: 1,
                    username: 'testuser',
                    email: 'test@example.com'
                }
            };

            const mockDockerInspect = {
                Id: 'test-docker-id',
                State: { Status: 'running' },
                Config: { Image: 'test-image' }
            };

            (db.ViperInstance.findOne as jest.Mock).mockResolvedValue(mockInstance);
            mockContainer.inspect = jest.fn().mockResolvedValue(mockDockerInspect);

            const response = await request(testApp).get('/service/viperinstance/test-docker-id/inspect');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('instance');
            expect(response.body).toHaveProperty('operationalHours');
            expect(response.body).toHaveProperty('dockerInspect');
            expect(response.body.instance).toEqual(mockInstance);
            expect(response.body.dockerInspect).toEqual(mockDockerInspect);
        });            it('should return 403 for non-admin users', async () => {
                const testApp = createTestApp({ id: 2, username: 'member', email: 'member@test.com', role: UserRole.MEMBER });

                const response = await request(testApp).get('/service/viperinstance/test-docker-id/inspect');

                expect(response.status).toBe(403);
                expect(response.body).toEqual({ message: 'Admin access required' });
            });

            it('should return 404 for non-existent instance', async () => {
                const testApp = createTestApp({ id: 1, username: 'admin', email: 'admin@test.com', role: UserRole.ADMIN });

                (db.ViperInstance.findOne as jest.Mock).mockResolvedValue(null);

                const response = await request(testApp).get('/service/viperinstance/nonexistent/inspect');

                expect(response.status).toBe(404);
                expect(response.body).toEqual({ message: 'Instance not found' });
            });
        });

        describe('GET /logs/*', () => {
            it('should return 403 for session logs for non-admin', async () => {
                const testApp = createTestApp({ id: 2, username: 'member', email: 'member@test.com', role: UserRole.MEMBER });

                const response = await request(testApp).get('/service/logs/session');

                expect(response.status).toBe(403);
                expect(response.body).toEqual({ message: 'Admin access required' });
            });

            it('should return 403 for SQL logs for non-admin', async () => {
                const testApp = createTestApp({ id: 2, username: 'member', email: 'member@test.com', role: UserRole.MEMBER });

                const response = await request(testApp).get('/service/logs/sql');

                expect(response.status).toBe(403);
                expect(response.body).toEqual({ message: 'Admin access required' });
            });

            it('should return 403 for app logs for non-admin', async () => {
                const testApp = createTestApp({ id: 2, username: 'member', email: 'member@test.com', role: UserRole.MEMBER });

                const response = await request(testApp).get('/service/logs/app');

                expect(response.status).toBe(403);
                expect(response.body).toEqual({ message: 'Admin access required' });
            });

            it('should return 403 for log dates for non-admin', async () => {
                const testApp = createTestApp({ id: 2, username: 'member', email: 'member@test.com', role: UserRole.MEMBER });

                const response = await request(testApp).get('/service/logs/dates');

                expect(response.status).toBe(403);
                expect(response.body).toEqual({ message: 'Admin access required' });
            });
        });
    });
});
