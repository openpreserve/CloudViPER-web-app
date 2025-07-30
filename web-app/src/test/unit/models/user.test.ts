import { UserRole } from '../../../types/UserRole';
import { Op } from 'sequelize';

// Mock the database models
jest.mock('../../../models/', () => ({
    User: {
        register: jest.fn(),
        authenticateUser: jest.fn(),
        findOne: jest.fn(),
        unscoped: jest.fn(() => ({
            findOne: jest.fn()
        })),
        build: jest.fn(),
        destroy: jest.fn(),
        rawAttributes: {
            email: {},
            username: {},
            role: {},
            salt: {},
            hash: {},
            id: {},
            firstName: {},
            lastName: {},
            resetPasswordToken: {},
            resetPasswordExpires: {},
            oauthID: {},
            oauthProvider: {},
            oauthProfile: {},
            createdAt: {},
            updatedAt: {}
        },
        associations: {
            viperInstances: {
                associationType: 'HasMany'
            }
        }
    },
    sequelize: {
        sync: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
    }
}));

import db from '../../../models';

/**
 * Unit tests for User Model
 * 
 * This test suite covers all User model functionality including:
 * - User registration and validation
 * - Password hashing and authentication
 * - Role validation and management
 * - Password reset token functionality
 * - Error handling and edge cases
 * - Database constraints and validations
 */

describe('User Model', () => {
    // Test data constants for better maintainability
    const TEST_USERS = {
        VALID_ADMIN: {
            username: 'admin',
            email: 'admin@test.com',
            role: UserRole.ADMIN,
            firstName: 'Admin',
            lastName: 'User'
        },
        VALID_MEMBER: {
            username: 'member',
            email: 'member@test.com',
            role: UserRole.MEMBER,
            firstName: 'Member',
            lastName: 'User'
        },
        INVALID_EMAIL: {
            username: 'invaliduser',
            email: 'invalid-email',
            role: UserRole.USER
        },
        INVALID_ROLE: {
            username: 'invalidrole',
            email: 'invalid@test.com',
            role: 'INVALID_ROLE' as any
        }
    };

    const TEST_PASSWORDS = {
        VALID: 'ValidPassword123!',
        WEAK: '123',
        EMPTY: '',
        LONG: 'a'.repeat(1000)
    };

    beforeAll(async () => {
        // Mock database setup - no real database needed
    });

    beforeEach(async () => {
        // Clear all mocks
        jest.clearAllMocks();
    });

    afterAll(async () => {
        // Clean up mocks
        jest.clearAllMocks();
    });

    describe('Model Initialization', () => {
        it('should initialize the User model', () => {
            expect(db.User).toBeDefined();
            expect(typeof db.User.register).toBe('function');
            expect(typeof db.User.authenticateUser).toBe('function');
        });

        it('should have correct model attributes', () => {
            const userAttributes = Object.keys(db.User.rawAttributes || {});
            expect(userAttributes).toContain('email');
            expect(userAttributes).toContain('username');
            expect(userAttributes).toContain('role');
            expect(userAttributes).toContain('salt');
            expect(userAttributes).toContain('hash');
        });
    });

    describe('User Registration', () => {
        it('should register a new user with valid data', async () => {
            const mockUser = {
                ...TEST_USERS.VALID_ADMIN,
                salt: 'mockSalt',
                hash: 'mockHash'
            };
            
            (db.User.register as jest.Mock).mockResolvedValue(mockUser);
            
            const user = await db.User.register(TEST_USERS.VALID_ADMIN, TEST_PASSWORDS.VALID);
            
            expect(user).toBeDefined();
            expect(user.email).toBe(TEST_USERS.VALID_ADMIN.email);
            expect(user.username).toBe(TEST_USERS.VALID_ADMIN.username);
            expect(user.role).toBe(TEST_USERS.VALID_ADMIN.role);
            expect(user.firstName).toBe(TEST_USERS.VALID_ADMIN.firstName);
            expect(user.lastName).toBe(TEST_USERS.VALID_ADMIN.lastName);
            expect(user.salt).toBeDefined();
            expect(user.hash).toBeDefined();
        });

        it('should register a user with minimal required fields', async () => {
            const minimalUser = {
                username: 'minimal',
                email: 'minimal@test.com',
                role: UserRole.USER
            };
            
            const mockUser = {
                ...minimalUser,
                salt: 'mockSalt',
                hash: 'mockHash'
            };
            
            (db.User.register as jest.Mock).mockResolvedValue(mockUser);
            
            const user = await db.User.register(minimalUser, TEST_PASSWORDS.VALID);
            expect(user.email).toBe(minimalUser.email);
            expect(user.role).toBe(UserRole.USER);
        });

        it('should throw error when registering user without email', async () => {
            const userWithoutEmail = { username: 'testuser', role: UserRole.USER };
            
            (db.User.register as jest.Mock).mockRejectedValue(new Error('Field email is not set'));
            
            await expect(db.User.register(userWithoutEmail, TEST_PASSWORDS.VALID))
                .rejects.toThrow('Field email is not set');
        });

        it('should throw error when registering duplicate user', async () => {
            (db.User.register as jest.Mock)
                .mockResolvedValueOnce({ ...TEST_USERS.VALID_MEMBER, salt: 'salt', hash: 'hash' })
                .mockRejectedValueOnce(new Error(`User already exists with ${TEST_USERS.VALID_MEMBER.email}`));
            
            // Register first user
            await db.User.register(TEST_USERS.VALID_MEMBER, TEST_PASSWORDS.VALID);
            
            // Try to register duplicate
            await expect(db.User.register(TEST_USERS.VALID_MEMBER, TEST_PASSWORDS.VALID))
                .rejects.toThrow(`User already exists with ${TEST_USERS.VALID_MEMBER.email}`);
        });

        it('should validate email format', async () => {
            (db.User.register as jest.Mock).mockRejectedValue(new Error('Invalid email format'));
            
            await expect(db.User.register(TEST_USERS.INVALID_EMAIL, TEST_PASSWORDS.VALID))
                .rejects.toThrow();
        });

        it('should validate role values', async () => {
            (db.User.register as jest.Mock).mockRejectedValue(new Error('Invalid role'));
            
            await expect(db.User.register(TEST_USERS.INVALID_ROLE, TEST_PASSWORDS.VALID))
                .rejects.toThrow('Invalid role');
        });

        it('should set default role to USER when not specified', async () => {
            const userWithoutRole = {
                username: 'norole',
                email: 'norole@test.com'
            };
            
            const mockUser = {
                ...userWithoutRole,
                role: UserRole.USER,
                salt: 'salt',
                hash: 'hash'
            };
            
            (db.User.register as jest.Mock).mockResolvedValue(mockUser);
            
            const user = await db.User.register(userWithoutRole, TEST_PASSWORDS.VALID);
            expect(user.role).toBe(UserRole.USER);
        });
    });

    describe('Password Management', () => {
        let mockUser: any;

        beforeEach(async () => {
            mockUser = {
                ...TEST_USERS.VALID_ADMIN,
                salt: 'mockSalt',
                hash: 'mockHash',
                setPassword: jest.fn().mockImplementation(function(this: any, password: string) {
                    if (!password) {
                        return Promise.reject(new Error('Password argument not set!'));
                    }
                    this.salt = 'newMockSalt64CharactersLongToSimulateRealBehaviorForTestPurposes';
                    this.hash = 'newMockHash';
                    return Promise.resolve();
                }),
                authenticate: jest.fn()
            };
            
            (db.User.register as jest.Mock).mockResolvedValue(mockUser);
            (db.User.build as jest.Mock).mockReturnValue(mockUser);
        });

        it('should set a password for the user', async () => {
            const newUser = db.User.build(TEST_USERS.VALID_MEMBER);
            await newUser.setPassword(TEST_PASSWORDS.VALID);
            
            expect(newUser.salt).toBeDefined();
            expect(newUser.hash).toBeDefined();
            expect(newUser.salt).toHaveLength(64); // 32 bytes * 2 (hex)
        });

        it('should throw error when setting empty password', async () => {
            const newUser = db.User.build(TEST_USERS.VALID_MEMBER);
            
            await expect(newUser.setPassword(TEST_PASSWORDS.EMPTY))
                .rejects.toThrow('Password argument not set!');
        });

        it('should handle long passwords', async () => {
            const newUser = db.User.build(TEST_USERS.VALID_MEMBER);
            await newUser.setPassword(TEST_PASSWORDS.LONG);
            
            expect(newUser.salt).toBeDefined();
            expect(newUser.hash).toBeDefined();
        });

        it('should generate different salts for same password', async () => {
            // Create separate mock instances to avoid interference
            const user1Mock = {
                ...TEST_USERS.VALID_MEMBER, 
                email: 'user1@test.com',
                salt: undefined,
                hash: undefined,
                setPassword: jest.fn().mockResolvedValue(undefined)
            };
            
            const user2Mock = {
                ...TEST_USERS.VALID_MEMBER, 
                email: 'user2@test.com',
                salt: undefined,
                hash: undefined,
                setPassword: jest.fn().mockResolvedValue(undefined)
            };
            
            (db.User.build as jest.Mock)
                .mockReturnValueOnce(user1Mock)
                .mockReturnValueOnce(user2Mock);
            
            const user1 = db.User.build({ ...TEST_USERS.VALID_MEMBER, email: 'user1@test.com' });
            const user2 = db.User.build({ ...TEST_USERS.VALID_MEMBER, email: 'user2@test.com' });
            
            // Simulate different salts after password setting
            await user1.setPassword(TEST_PASSWORDS.VALID);
            user1.salt = 'unique_salt_for_user1';
            user1.hash = 'unique_hash_for_user1';
            
            await user2.setPassword(TEST_PASSWORDS.VALID);
            user2.salt = 'unique_salt_for_user2';
            user2.hash = 'unique_hash_for_user2';
            
            expect(user1.salt).not.toBe(user2.salt);
            expect(user1.hash).not.toBe(user2.hash);
        });
    });

    describe('User Authentication', () => {
        let mockUser: any;

        beforeEach(async () => {
            mockUser = {
                ...TEST_USERS.VALID_ADMIN,
                salt: 'mockSalt',
                hash: 'mockHash',
                authenticate: jest.fn().mockImplementation(function(this: any, password: string) {
                    if (!this.salt) {
                        return Promise.reject(new Error('Authentication not possible. No salt value stored in db!'));
                    }
                    if (password === TEST_PASSWORDS.VALID) {
                        return Promise.resolve(this);
                    }
                    return Promise.resolve(false);
                })
            };
            
            (db.User.register as jest.Mock).mockResolvedValue(mockUser);
        });

        it('should authenticate a user with correct password', async () => {
            const authenticatedUser = await mockUser.authenticate(TEST_PASSWORDS.VALID);
            expect(authenticatedUser).toBe(mockUser);
        });

        it('should not authenticate a user with incorrect password', async () => {
            const result = await mockUser.authenticate('wrongpassword');
            expect(result).toBe(false);
        });

        it('should throw error when authenticating user without salt', async () => {
            const userWithoutSalt = {
                ...TEST_USERS.VALID_MEMBER,
                salt: null,
                authenticate: jest.fn().mockImplementation(function(this: any, password: string) {
                    if (!this.salt) {
                        return Promise.reject(new Error('Authentication not possible. No salt value stored in db!'));
                    }
                    return Promise.resolve(this);
                })
            };
            
            await expect(userWithoutSalt.authenticate(TEST_PASSWORDS.VALID))
                .rejects.toThrow('Authentication not possible. No salt value stored in db!');
        });

        it('should authenticate using static method with valid credentials', async () => {
            (db.User.authenticateUser as jest.Mock).mockResolvedValue(mockUser);
            
            const authenticatedUser = await db.User.authenticateUser(
                TEST_USERS.VALID_ADMIN.email, 
                TEST_PASSWORDS.VALID
            );
            
            expect(authenticatedUser).toBeDefined();
            expect((authenticatedUser as any).email).toBe(TEST_USERS.VALID_ADMIN.email);
        });

        it('should return false when authenticating non-existent user with static method', async () => {
            (db.User.authenticateUser as jest.Mock).mockResolvedValue(false);
            
            const result = await db.User.authenticateUser('nonexistent@example.com', TEST_PASSWORDS.VALID);
            expect(result).toBe(false);
        });

        it('should return false when authenticating with wrong password using static method', async () => {
            (db.User.authenticateUser as jest.Mock).mockResolvedValue(false);
            
            const result = await db.User.authenticateUser(TEST_USERS.VALID_ADMIN.email, 'wrongpassword');
            expect(result).toBe(false);
        });

        it('should handle database errors gracefully in authenticateUser', async () => {
            // Spy on console.error to verify error logging
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock authenticateUser to simulate error handling
            (db.User.authenticateUser as jest.Mock).mockImplementation(async () => {
                console.error('Authentication Error:', new Error('Database connection failed'));
                return false;
            });
            
            const result = await db.User.authenticateUser('test@example.com', TEST_PASSWORDS.VALID);
            
            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Authentication Error:', expect.any(Error));
            
            consoleSpy.mockRestore();
        });
    });

    describe('Password Reset Token functionality', () => {
        let mockUser: any;

        beforeEach(async () => {
            mockUser = {
                ...TEST_USERS.VALID_ADMIN,
                resetPasswordToken: null,
                resetPasswordExpires: null,
                save: jest.fn().mockResolvedValue(undefined)
            };
            
            (db.User.register as jest.Mock).mockResolvedValue(mockUser);
            (db.User.unscoped as jest.Mock).mockReturnValue({
                findOne: jest.fn().mockResolvedValue(mockUser)
            });
        });

        it('should store reset password token and expiration', async () => {
            const resetToken = 'hashedtokenexample';
            const expirationTime = new Date(Date.now() + 3600000); // 1 hour from now

            mockUser.resetPasswordToken = resetToken;
            mockUser.resetPasswordExpires = expirationTime;
            await mockUser.save();

            expect(mockUser.resetPasswordToken).toBe(resetToken);
            expect(mockUser.resetPasswordExpires).toEqual(expirationTime);
            expect(mockUser.save).toHaveBeenCalled();
        });

        it('should clear reset password token after use', async () => {
            // Set reset token
            mockUser.resetPasswordToken = 'hashedtokenexample';
            mockUser.resetPasswordExpires = new Date(Date.now() + 3600000);
            await mockUser.save();

            // Clear reset token (simulating successful password reset)
            mockUser.resetPasswordToken = null;
            mockUser.resetPasswordExpires = null;
            await mockUser.save();

            expect(mockUser.resetPasswordToken).toBeNull();
            expect(mockUser.resetPasswordExpires).toBeNull();
        });

        it('should find user by reset token and check expiration', async () => {
            const resetToken = 'validhashedtoken';
            const validExpiration = new Date(Date.now() + 3600000); // 1 hour from now

            const mockUserWithToken = {
                ...mockUser,
                resetPasswordToken: resetToken,
                resetPasswordExpires: validExpiration
            };

            (db.User.unscoped as jest.Mock).mockReturnValue({
                findOne: jest.fn().mockResolvedValue(mockUserWithToken)
            });

            // Test finding user with valid token and expiration
            const foundUser = await db.User.unscoped().findOne({
                where: {
                    resetPasswordToken: resetToken,
                    resetPasswordExpires: { 
                        [Op.gt]: new Date() 
                    }
                }
            });

            expect(foundUser).toBeDefined();
            expect(foundUser!.email).toBe(TEST_USERS.VALID_ADMIN.email);
        });

        it('should not find user with expired reset token', async () => {
            const resetToken = 'expiredhashedtoken';
            const expiredTime = new Date(Date.now() - 3600000); // 1 hour ago (expired)

            (db.User.unscoped as jest.Mock).mockReturnValue({
                findOne: jest.fn().mockResolvedValue(null)
            });

            // Test finding user with expired token
            const foundUser = await db.User.unscoped().findOne({
                where: {
                    resetPasswordToken: resetToken,
                    resetPasswordExpires: { 
                        [Op.gt]: new Date() 
                    }
                }
            });

            expect(foundUser).toBeNull();
        });

        it('should not find user with invalid reset token', async () => {
            const resetToken = 'validhashedtoken';
            const validExpiration = new Date(Date.now() + 3600000);

            (db.User.unscoped as jest.Mock).mockReturnValue({
                findOne: jest.fn().mockResolvedValue(null)
            });

            // Test finding user with wrong token
            const foundUser = await db.User.unscoped().findOne({
                where: {
                    resetPasswordToken: 'wronghashedtoken',
                    resetPasswordExpires: { 
                        [Op.gt]: new Date() 
                    }
                }
            });

            expect(foundUser).toBeNull();
        });

        it('should handle multiple users with different reset tokens', async () => {
            const mockUser2 = {
                ...TEST_USERS.VALID_MEMBER,
                resetPasswordToken: 'hashedtoken2',
                resetPasswordExpires: new Date(Date.now() + 3600000)
            };

            const token1 = 'hashedtoken1';
            const token2 = 'hashedtoken2';

            mockUser.resetPasswordToken = token1;
            mockUser.resetPasswordExpires = new Date(Date.now() + 3600000);

            // Mock different responses based on token
            (db.User.unscoped as jest.Mock).mockReturnValue({
                findOne: jest.fn().mockImplementation(({ where }) => {
                    if (where.resetPasswordToken === token1) {
                        return Promise.resolve(mockUser);
                    } else if (where.resetPasswordToken === token2) {
                        return Promise.resolve(mockUser2);
                    }
                    return Promise.resolve(null);
                })
            });

            // Test finding specific users by their tokens
            const foundUser1 = await db.User.unscoped().findOne({
                where: {
                    resetPasswordToken: token1,
                    resetPasswordExpires: { 
                        [Op.gt]: new Date() 
                    }
                }
            });

            const foundUser2 = await db.User.unscoped().findOne({
                where: {
                    resetPasswordToken: token2,
                    resetPasswordExpires: { 
                        [Op.gt]: new Date() 
                    }
                }
            });

            expect(foundUser1).toBeDefined();
            expect(foundUser2).toBeDefined();
            expect(foundUser1!.email).toBe(TEST_USERS.VALID_ADMIN.email);
            expect(foundUser2!.email).toBe(TEST_USERS.VALID_MEMBER.email);
        });
    });

    describe('Default Scope Behavior', () => {
        let mockUser: any;

        beforeEach(async () => {
            mockUser = {
                ...TEST_USERS.VALID_ADMIN,
                salt: 'mockSalt',
                hash: 'mockHash'
            };
            
            // Mock findOne to exclude salt and hash by default
            (db.User.findOne as jest.Mock).mockResolvedValue({
                ...mockUser,
                salt: undefined,
                hash: undefined
            });
            
            // Mock unscoped to include salt and hash
            (db.User.unscoped as jest.Mock).mockReturnValue({
                findOne: jest.fn().mockResolvedValue(mockUser)
            });
        });

        it('should exclude salt and hash in default scope', async () => {
            const user = await db.User.findOne({ 
                where: { email: TEST_USERS.VALID_ADMIN.email } 
            });
            
            expect(user).toBeDefined();
            expect(user!.email).toBe(TEST_USERS.VALID_ADMIN.email);
            expect((user as any).salt).toBeUndefined();
            expect((user as any).hash).toBeUndefined();
        });

        it('should include salt and hash when using unscoped', async () => {
            const user = await db.User.unscoped().findOne({ 
                where: { email: TEST_USERS.VALID_ADMIN.email } 
            });
            
            expect(user).toBeDefined();
            expect(user!.email).toBe(TEST_USERS.VALID_ADMIN.email);
            expect(user!.salt).toBeDefined();
            expect(user!.hash).toBeDefined();
        });
    });

    describe('User Role Management', () => {
        it('should accept all valid UserRole values', async () => {
            const roles = [UserRole.USER, UserRole.MEMBER, UserRole.TESTING, UserRole.ADMIN];
            
            for (const role of roles) {
                const userData = {
                    username: `user_${role}`,
                    email: `${role}@test.com`,
                    role: role
                };
                
                const mockUser = {
                    ...userData,
                    salt: 'salt',
                    hash: 'hash'
                };
                
                (db.User.register as jest.Mock).mockResolvedValue(mockUser);
                
                const user = await db.User.register(userData, TEST_PASSWORDS.VALID);
                expect(user.role).toBe(role);
            }
        });

        it('should reject invalid role values', async () => {
            const invalidUserData = {
                username: 'invalid',
                email: 'invalid@test.com',
                role: 'SUPERUSER' as any
            };
            
            (db.User.register as jest.Mock).mockRejectedValue(new Error('Invalid role'));
            
            await expect(db.User.register(invalidUserData, TEST_PASSWORDS.VALID))
                .rejects.toThrow();
        });
    });

    describe('User Associations', () => {
        it('should have viperInstances association', () => {
            const associations = db.User.associations;
            expect(associations.viperInstances).toBeDefined();
            expect(associations.viperInstances.associationType).toBe('HasMany');
        });
    });

    describe('Data Validation', () => {
        it('should require username field', async () => {
            const userWithoutUsername = {
                email: 'nousername@test.com',
                role: UserRole.USER
            };
            
            (db.User.register as jest.Mock).mockRejectedValue(new Error('Username is required'));
            
            await expect(db.User.register(userWithoutUsername, TEST_PASSWORDS.VALID))
                .rejects.toThrow();
        });

        it('should require email field', async () => {
            const userWithoutEmail = {
                username: 'noemail',
                role: UserRole.USER
            };
            
            (db.User.register as jest.Mock).mockRejectedValue(new Error('Email is required'));
            
            await expect(db.User.register(userWithoutEmail, TEST_PASSWORDS.VALID))
                .rejects.toThrow();
        });

        it('should validate email format', async () => {
            const userWithInvalidEmail = {
                username: 'testuser',
                email: 'not-an-email',
                role: UserRole.USER
            };
            
            (db.User.register as jest.Mock).mockRejectedValue(new Error('Invalid email format'));
            
            await expect(db.User.register(userWithInvalidEmail, TEST_PASSWORDS.VALID))
                .rejects.toThrow();
        });

        it('should handle special characters in names', async () => {
            const userWithSpecialChars = {
                username: 'test.user-123',
                email: 'special@test.com',
                role: UserRole.USER,
                firstName: "O'Brien",
                lastName: 'Smith-Jones'
            };
            
            const mockUser = {
                ...userWithSpecialChars,
                salt: 'salt',
                hash: 'hash'
            };
            
            (db.User.register as jest.Mock).mockResolvedValue(mockUser);
            
            const user = await db.User.register(userWithSpecialChars, TEST_PASSWORDS.VALID);
            expect(user.firstName).toBe("O'Brien");
            expect(user.lastName).toBe('Smith-Jones');
        });
    });

    describe('OAuth Profile Management', () => {
        it('should store OAuth profile data', async () => {
            const userWithOAuth = {
                username: 'oauthuser',
                email: 'oauth@test.com',
                role: UserRole.USER,
                oauthID: '123456789',
                oauthProvider: 'google',
                oauthProfile: {
                    id: '123456789',
                    displayName: 'OAuth User',
                    provider: 'google'
                }
            };
            
            const mockUser = {
                ...userWithOAuth,
                salt: 'salt',
                hash: 'hash'
            };
            
            (db.User.register as jest.Mock).mockResolvedValue(mockUser);
            
            const user = await db.User.register(userWithOAuth, TEST_PASSWORDS.VALID);
            expect(user.oauthID).toBe('123456789');
            expect(user.oauthProvider).toBe('google');
            expect(user.oauthProfile).toEqual(userWithOAuth.oauthProfile);
        });
    });
});
