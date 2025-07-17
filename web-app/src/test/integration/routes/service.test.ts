import request from 'supertest';
import express from 'express';
import session from 'express-session';
import serviceRouter from '../../../routes/service';
import db from '../../../models';
import Docker from 'dockerode';
import getPort from 'get-port';
import helperFunctions from '../../../utility/helperFunctions';

// Mock dependencies
jest.mock('dockerode');
jest.mock('get-port');
jest.mock('../../../utility/helperFunctions');
jest.mock('../../../models');

const MockedDocker = Docker as jest.MockedClass<typeof Docker>;
const mockedGetPort = getPort as jest.MockedFunction<typeof getPort>;
const mockedHelperFunctions = helperFunctions as jest.Mocked<typeof helperFunctions>;

describe('Service Routes', () => {
    let app: express.Application;
    let mockDockerInstance: any;
    let mockContainer: any;
    let mockExec: any;
    let mockStream: any;

    beforeAll(async () => {
        // Sync database for tests
        await db.sequelize.sync({ force: true });
    });

    beforeEach(() => {
        // Create Express app
        app = express();
        
        // Setup session middleware
        app.use(session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: false,
            cookie: { secure: false }
        }));

        // Setup request body parsing
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Mock user authentication middleware
        app.use((req, res, next) => {
            // This will be overridden in individual tests
            next();
        });

        app.use('/service', serviceRouter);

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

        mockContainer = {
            id: 'mock-container-id',
            start: jest.fn().mockResolvedValue(undefined),
            exec: jest.fn().mockResolvedValue(mockExec),
            stop: jest.fn().mockImplementation((callback) => {
                callback(null, 'stopped');
            }),
            remove: jest.fn().mockImplementation((callback) => {
                callback(null, 'removed');
            })
        };

        mockDockerInstance = {
            createContainer: jest.fn().mockResolvedValue(mockContainer),
            getContainer: jest.fn().mockReturnValue(mockContainer)
        };

        MockedDocker.mockImplementation(() => mockDockerInstance);

        // Setup other mocks
        mockedGetPort.mockResolvedValue(3001);
        mockedHelperFunctions.generateRandomString.mockReturnValue('mock-random-string');

        // Mock database models
        db.ViperInstance = {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            destroy: jest.fn()
        } as any;

        db.Log = {
            create: jest.fn()
        } as any;

        // Clear all mocks
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await db.sequelize.close();
    });

    describe('GET /', () => {
        it('should redirect admin users to /service/admin', async () => {
            app.use((req, res, next) => {
                req.user = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };
                next();
            });

            const response = await request(app).get('/service/');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/service/admin');
        });

        it('should redirect testing users to /service/testing', async () => {
            app.use((req, res, next) => {
                req.user = { id: 2, username: 'tester', email: 'test@test.com', role: 'testing' };
                next();
            });

            const response = await request(app).get('/service/');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/service/testing');
        });

        it('should redirect member users to /service/member', async () => {
            app.use((req, res, next) => {
                req.user = { id: 3, username: 'member', email: 'member@test.com', role: 'member' };
                next();
            });

            const response = await request(app).get('/service/');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/service/member');
        });

        it('should redirect users with default role to /account', async () => {
            app.use((req, res, next) => {
                req.user = { id: 4, username: 'user', email: 'user@test.com', role: 'user' };
                next();
            });

            const response = await request(app).get('/service/');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/account');
        });

        it('should redirect unauthenticated users to login', async () => {
            const response = await request(app).get('/service/');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/account/login');
        });
    });

    describe('GET /admin', () => {
        it('should render admin page for admin users', async () => {
            app.use((req, res, next) => {
                req.user = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };
                next();
            });

            // Mock the render function
            const mockRender = jest.fn((template, data) => {
                expect(template).toBe('service_admin');
                expect(data.user).toEqual({
                    id: 1,
                    username: 'admin',
                    email: 'admin@test.com',
                    role: 'admin'
                });
            });

            app.use((req, res, next) => {
                res.render = mockRender;
                next();
            });

            await request(app).get('/service/admin');
            expect(mockRender).toHaveBeenCalled();
        });

        it('should redirect non-admin users', async () => {
            app.use((req, res, next) => {
                req.user = { id: 2, username: 'member', email: 'member@test.com', role: 'member' };
                next();
            });

            const response = await request(app).get('/service/admin');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/service');
        });

        it('should redirect unauthenticated users', async () => {
            const response = await request(app).get('/service/admin');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/service');
        });
    });

    describe('GET /testing', () => {
        it('should render testing page for testing users', async () => {
            app.use((req, res, next) => {
                req.user = { id: 2, username: 'tester', email: 'test@test.com', role: 'testing' };
                next();
            });

            const mockRender = jest.fn((template, data) => {
                expect(template).toBe('service_testing');
                expect(data.user).toEqual({
                    id: 2,
                    username: 'tester',
                    email: 'test@test.com',
                    role: 'testing'
                });
            });

            app.use((req, res, next) => {
                res.render = mockRender;
                next();
            });

            await request(app).get('/service/testing');
            expect(mockRender).toHaveBeenCalled();
        });

        it('should redirect non-testing users', async () => {
            app.use((req, res, next) => {
                req.user = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };
                next();
            });

            const response = await request(app).get('/service/testing');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/service');
        });
    });

    describe('GET /member', () => {
        it('should render member page for member users', async () => {
            app.use((req, res, next) => {
                req.user = { id: 3, username: 'member', email: 'member@test.com', role: 'member' };
                next();
            });

            const mockRender = jest.fn((template, data) => {
                expect(template).toBe('service_member');
                expect(data.user).toEqual({
                    id: 3,
                    username: 'member',
                    email: 'member@test.com',
                    role: 'member'
                });
            });

            app.use((req, res, next) => {
                res.render = mockRender;
                next();
            });

            await request(app).get('/service/member');
            expect(mockRender).toHaveBeenCalled();
        });

        it('should redirect non-member users', async () => {
            app.use((req, res, next) => {
                req.user = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };
                next();
            });

            const response = await request(app).get('/service/member');
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/service');
        });
    });

    describe('GET /new-instance', () => {
        beforeEach(() => {
            // Mock ViperInstance creation
            (db.ViperInstance.create as jest.Mock).mockResolvedValue({
                id: 1,
                uuid: 'mock-random-string',
                dockerid: 'mock-container-id',
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
            app.use((req, res, next) => {
                req.user = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };
                next();
            });

            const response = await request(app).get('/service/new-instance');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                container: {
                    id: 'mock-container-id',
                    uuid: 'mock-random-string',
                    url: 'mock-random-string.localhost'
                }
            });

            expect(mockDockerInstance.createContainer).toHaveBeenCalled();
            expect(mockContainer.start).toHaveBeenCalled();
            expect(db.ViperInstance.create).toHaveBeenCalled();
        });

        it('should create new instance for testing user', async () => {
            app.use((req, res, next) => {
                req.user = { id: 2, username: 'tester', email: 'test@test.com', role: 'testing' };
                next();
            });

            const response = await request(app).get('/service/new-instance');
            expect(response.status).toBe(200);
            expect(mockDockerInstance.createContainer).toHaveBeenCalled();
        });

        it('should create new instance for member user', async () => {
            app.use((req, res, next) => {
                req.user = { id: 3, username: 'member', email: 'member@test.com', role: 'member' };
                next();
            });

            const response = await request(app).get('/service/new-instance');
            expect(response.status).toBe(200);
            expect(mockDockerInstance.createContainer).toHaveBeenCalled();
        });

        it('should reject user role', async () => {
            app.use((req, res, next) => {
                req.user = { id: 4, username: 'user', email: 'user@test.com', role: 'user' };
                next();
            });

            const response = await request(app).get('/service/new-instance');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ "error": "Authentication" });
            expect(mockDockerInstance.createContainer).not.toHaveBeenCalled();
        });

        it('should reject unauthenticated users', async () => {
            const response = await request(app).get('/service/new-instance');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ "error": "Authentication" });
        });

        it('should handle Docker errors', async () => {
            app.use((req, res, next) => {
                req.user = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };
                next();
            });

            const dockerError = new Error('Docker failed');
            mockDockerInstance.createContainer.mockRejectedValue(dockerError);

            // Mock Log creation
            (db.Log.create as jest.Mock).mockResolvedValue({});

            const response = await request(app).get('/service/new-instance');
            
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Error creating or starting container' });
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
            app.use((req, res, next) => {
                req.user = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };
                next();
            });

            const mockInstances = [
                { id: 1, uuid: 'test1', owner: 1 },
                { id: 2, uuid: 'test2', owner: 2 }
            ];

            (db.ViperInstance.findAll as jest.Mock).mockResolvedValue(mockInstances);

            const response = await request(app).get('/service/viperinstances');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockInstances);
            expect(db.ViperInstance.findAll).toHaveBeenCalledWith();
        });

        it('should return user instances for non-admin, non-user roles', async () => {
            app.use((req, res, next) => {
                req.user = { id: 2, username: 'member', email: 'member@test.com', role: 'member' };
                next();
            });

            const userInstances = [
                { id: 1, uuid: 'test1', owner: 2 }
            ];

            (db.ViperInstance.findAll as jest.Mock).mockResolvedValue(userInstances);

            const response = await request(app).get('/service/viperinstances');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual(userInstances);
            expect(db.ViperInstance.findAll).toHaveBeenCalledWith({
                where: { owner: 2 }
            });
        });

        it('should return 403 for user role', async () => {
            app.use((req, res, next) => {
                req.user = { id: 4, username: 'user', email: 'user@test.com', role: 'user' };
                next();
            });

            const response = await request(app).get('/service/viperinstances');
            
            expect(response.status).toBe(403);
            expect(response.body).toEqual({ message: 'Error 4' });
        });

        it('should return 403 for unauthenticated users', async () => {
            const response = await request(app).get('/service/viperinstances');
            
            expect(response.status).toBe(403);
            expect(response.body).toEqual({ message: 'Error 4' });
        });

        it('should handle database errors for admin', async () => {
            app.use((req, res, next) => {
                req.user = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };
                next();
            });

            const dbError = new Error('Database error');
            (db.ViperInstance.findAll as jest.Mock).mockRejectedValue(dbError);

            const response = await request(app).get('/service/viperinstances');
            
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ 
                message: 'Error retrieving viper instances', 
                error: dbError 
            });
        });

        it('should handle database errors for non-admin users', async () => {
            app.use((req, res, next) => {
                req.user = { id: 2, username: 'member', email: 'member@test.com', role: 'member' };
                next();
            });

            const dbError = new Error('Database error');
            (db.ViperInstance.findAll as jest.Mock).mockRejectedValue(dbError);

            const response = await request(app).get('/service/viperinstances');
            
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ 
                message: 'Error retrieving viper instances', 
                error: dbError 
            });
        });
    });

    describe('GET /terminate-instance/:containerId', () => {
        beforeEach(() => {
            // Mock destroy method instead of save
            (db.ViperInstance.destroy as jest.Mock) = jest.fn().mockResolvedValue(1);
        });

        it('should successfully terminate container', async () => {
            const response = await request(app).get('/service/terminate-instance/test-container-id');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                REMOVE: { 'Container removed': 'removed' },
                DATABASE: { 'Entry Removed': 'test-container-id' }
            });

            expect(mockDockerInstance.getContainer).toHaveBeenCalledWith('test-container-id');
            expect(mockContainer.stop).toHaveBeenCalled();
            expect(mockContainer.remove).toHaveBeenCalled();
            expect(db.ViperInstance.destroy).toHaveBeenCalledWith({
                where: { dockerid: 'test-container-id' }
            });
        });

        it('should handle container stop error', async () => {
            mockContainer.stop.mockImplementation((callback: (err: Error | null, data: any) => void) => {
                callback(new Error('Stop failed'), null);
            });

            const response = await request(app).get('/service/terminate-instance/test-container-id');
            
            expect(response.status).toBe(200);
            expect(response.body['STOP-ERROR']).toBeDefined();
        });

        it('should handle container remove error', async () => {
            mockContainer.remove.mockImplementation((callback: (err: Error | null, data: any) => void) => {
                callback(new Error('Remove failed'), null);
            });

            const response = await request(app).get('/service/terminate-instance/test-container-id');
            
            expect(response.status).toBe(200);
            expect(response.body['REMOVE-ERROR']).toBeDefined();
        });

        it('should handle instance not found in database', async () => {
            (db.ViperInstance.destroy as jest.Mock).mockResolvedValue(0); // 0 rows affected means not found

            const response = await request(app).get('/service/terminate-instance/test-container-id');
            
            expect(response.status).toBe(200);
            // Should still stop and remove container even if DB record not found
            expect(mockContainer.stop).toHaveBeenCalled();
            expect(mockContainer.remove).toHaveBeenCalled();
            expect(response.body).toEqual({
                REMOVE: { 'Container removed': 'removed' },
                DATABASE: { 'Entry Removed': 'test-container-id' }
            });
        });

        it('should handle database error', async () => {
            const dbError = new Error('Database error');
            (db.ViperInstance.destroy as jest.Mock).mockRejectedValue(dbError);

            const response = await request(app).get('/service/terminate-instance/test-container-id');
            
            expect(response.status).toBe(200);
            expect(response.body.DATABASE.Error).toEqual(dbError);
        });
    });

    describe('GET /set-status-instance/:statuskey/:status', () => {
        it('should successfully update instance status', async () => {
            const mockInstance = {
                logs: [{ timestamp: new Date(), message: 'Initial log' }],
                status: 'active',
                save: jest.fn().mockResolvedValue(undefined)
            };

            (db.ViperInstance.findOne as jest.Mock).mockResolvedValue(mockInstance);

            const response = await request(app)
                .get('/service/set-status-instance/test-status-key/inactive');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                DATABASE: { 'Entry Updated': 'test-status-key' }
            });

            expect(db.ViperInstance.findOne).toHaveBeenCalledWith({
                where: { statusKey: 'test-status-key' }
            });

            expect(mockInstance.status).toBe('inactive');
            expect(mockInstance.logs).toHaveLength(2);
            expect(mockInstance.logs[1].message).toBe('Set Status to: inactive');
            expect(mockInstance.save).toHaveBeenCalled();
        });

        it('should handle instance not found', async () => {
            (db.ViperInstance.findOne as jest.Mock).mockResolvedValue(null);

            const response = await request(app)
                .get('/service/set-status-instance/nonexistent-key/active');
            
            expect(response.status).toBe(200);
            // The endpoint doesn't send a response when instance is not found
            // This is following the current implementation behavior
        });

        it('should handle database error', async () => {
            const dbError = new Error('Database error');
            (db.ViperInstance.findOne as jest.Mock).mockRejectedValue(dbError);

            const response = await request(app)
                .get('/service/set-status-instance/test-status-key/active');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                DATABASE: { 'Error': dbError }
            });
        });

        it('should handle save error', async () => {
            const saveError = new Error('Save failed');
            const mockInstance = {
                logs: [],
                status: 'active',
                save: jest.fn().mockRejectedValue(saveError)
            };

            (db.ViperInstance.findOne as jest.Mock).mockResolvedValue(mockInstance);

            const response = await request(app)
                .get('/service/set-status-instance/test-status-key/inactive');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                DATABASE: { 'Error': saveError }
            });
        });
    });

    describe('Environment Variables and Configuration', () => {
        it('should use production configuration in prod environment', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'prod';

            app.use((req, res, next) => {
                req.user = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };
                next();
            });

            (db.ViperInstance.create as jest.Mock).mockResolvedValue({});

            await request(app).get('/service/new-instance');

            const createContainerCall = mockDockerInstance.createContainer.mock.calls[0][0];
            expect(createContainerCall.NetworkingConfig.EndpointsConfig).toHaveProperty('ingress-proxy');
            expect(createContainerCall.HostConfig.PortBindings).toBeUndefined();

            process.env.NODE_ENV = originalEnv;
        });

        it('should use development configuration in dev environment', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'dev';

            app.use((req, res, next) => {
                req.user = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };
                next();
            });

            (db.ViperInstance.create as jest.Mock).mockResolvedValue({});

            await request(app).get('/service/new-instance');

            const createContainerCall = mockDockerInstance.createContainer.mock.calls[0][0];
            expect(createContainerCall.HostConfig.PortBindings).toBeDefined();
            expect(createContainerCall.HostConfig.PortBindings['3000/tcp']).toEqual([{ HostPort: '3001' }]);

            process.env.NODE_ENV = originalEnv;
        });
    });
});
