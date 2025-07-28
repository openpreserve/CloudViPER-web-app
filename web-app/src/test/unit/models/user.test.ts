import db from '../../../models';
import { UserRole } from '../../../types/UserRole';
import { Op } from 'sequelize';

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
        // Sync database for tests
        await db.sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        // Clean up any existing test data
        await db.User.destroy({ where: {}, force: true });
    });

    afterAll(async () => {
        await db.sequelize.close();
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
            
            const user = await db.User.register(minimalUser, TEST_PASSWORDS.VALID);
            expect(user.email).toBe(minimalUser.email);
            expect(user.role).toBe(UserRole.USER);
        });

        it('should throw error when registering user without email', async () => {
            const userWithoutEmail = { username: 'testuser', role: UserRole.USER };
            
            await expect(db.User.register(userWithoutEmail, TEST_PASSWORDS.VALID))
                .rejects.toThrow('Field email is not set');
        });

        it('should throw error when registering duplicate user', async () => {
            // Register first user
            await db.User.register(TEST_USERS.VALID_MEMBER, TEST_PASSWORDS.VALID);
            
            // Try to register duplicate
            await expect(db.User.register(TEST_USERS.VALID_MEMBER, TEST_PASSWORDS.VALID))
                .rejects.toThrow(`User already exists with ${TEST_USERS.VALID_MEMBER.email}`);
        });

        it('should validate email format', async () => {
            await expect(db.User.register(TEST_USERS.INVALID_EMAIL, TEST_PASSWORDS.VALID))
                .rejects.toThrow();
        });

        it('should validate role values', async () => {
            await expect(db.User.register(TEST_USERS.INVALID_ROLE, TEST_PASSWORDS.VALID))
                .rejects.toThrow('Invalid role');
        });

        it('should set default role to USER when not specified', async () => {
            const userWithoutRole = {
                username: 'norole',
                email: 'norole@test.com'
            };
            
            const user = await db.User.register(userWithoutRole, TEST_PASSWORDS.VALID);
            expect(user.role).toBe(UserRole.USER);
        });
    });

    describe('Password Management', () => {
        let testUser: any;

        beforeEach(async () => {
            testUser = await db.User.register(TEST_USERS.VALID_ADMIN, TEST_PASSWORDS.VALID);
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
            const user1 = db.User.build({ ...TEST_USERS.VALID_MEMBER, email: 'user1@test.com' });
            const user2 = db.User.build({ ...TEST_USERS.VALID_MEMBER, email: 'user2@test.com' });
            
            await user1.setPassword(TEST_PASSWORDS.VALID);
            await user2.setPassword(TEST_PASSWORDS.VALID);
            
            expect(user1.salt).not.toBe(user2.salt);
            expect(user1.hash).not.toBe(user2.hash);
        });
    });

    describe('User Authentication', () => {
        let testUser: any;

        beforeEach(async () => {
            testUser = await db.User.register(TEST_USERS.VALID_ADMIN, TEST_PASSWORDS.VALID);
        });

        it('should authenticate a user with correct password', async () => {
            const authenticatedUser = await testUser.authenticate(TEST_PASSWORDS.VALID);
            expect(authenticatedUser).toBe(testUser);
        });

        it('should not authenticate a user with incorrect password', async () => {
            const result = await testUser.authenticate('wrongpassword');
            expect(result).toBe(false);
        });

        it('should throw error when authenticating user without salt', async () => {
            const userWithoutSalt = db.User.build(TEST_USERS.VALID_MEMBER);
            
            await expect(userWithoutSalt.authenticate(TEST_PASSWORDS.VALID))
                .rejects.toThrow('Authentication not possible. No salt value stored in db!');
        });

        it('should authenticate using static method with valid credentials', async () => {
            const authenticatedUser = await db.User.authenticateUser(
                TEST_USERS.VALID_ADMIN.email, 
                TEST_PASSWORDS.VALID
            );
            
            expect(authenticatedUser).toBeDefined();
            expect((authenticatedUser as any).email).toBe(TEST_USERS.VALID_ADMIN.email);
        });

        it('should return false when authenticating non-existent user with static method', async () => {
            const result = await db.User.authenticateUser('nonexistent@example.com', TEST_PASSWORDS.VALID);
            expect(result).toBe(false);
        });

        it('should return false when authenticating with wrong password using static method', async () => {
            const result = await db.User.authenticateUser(TEST_USERS.VALID_ADMIN.email, 'wrongpassword');
            expect(result).toBe(false);
        });

        it('should handle database errors gracefully in authenticateUser', async () => {
            // Spy on console.error to verify error logging
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock findOne to throw an error
            const originalUnscoped = db.User.unscoped;
            const mockUnscoped = jest.fn().mockReturnValue({
                findOne: jest.fn().mockRejectedValue(new Error('Database connection failed'))
            });
            (db.User as any).unscoped = mockUnscoped;
            
            const result = await db.User.authenticateUser('test@example.com', TEST_PASSWORDS.VALID);
            
            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Authentication Error:', expect.any(Error));
            
            // Restore original method
            (db.User as any).unscoped = originalUnscoped;
            consoleSpy.mockRestore();
        });
    });

    describe('Password Reset Token functionality', () => {
        let testUser: any;

        beforeEach(async () => {
            testUser = await db.User.register(TEST_USERS.VALID_ADMIN, TEST_PASSWORDS.VALID);
        });

        it('should store reset password token and expiration', async () => {
            const resetToken = 'hashedtokenexample';
            const expirationTime = new Date(Date.now() + 3600000); // 1 hour from now

            testUser.resetPasswordToken = resetToken;
            testUser.resetPasswordExpires = expirationTime;
            await testUser.save();

            const savedUser = await db.User.unscoped().findOne({ 
                where: { email: TEST_USERS.VALID_ADMIN.email } 
            });
            expect(savedUser).toBeDefined();
            expect(savedUser!.resetPasswordToken).toBe(resetToken);
            
            // Check that dates are approximately equal (within 1 second)
            const timeDiff = Math.abs(savedUser!.resetPasswordExpires!.getTime() - expirationTime.getTime());
            expect(timeDiff).toBeLessThan(1000);
        });

        it('should clear reset password token after use', async () => {
            // Set reset token
            testUser.resetPasswordToken = 'hashedtokenexample';
            testUser.resetPasswordExpires = new Date(Date.now() + 3600000);
            await testUser.save();

            // Clear reset token (simulating successful password reset)
            testUser.resetPasswordToken = null;
            testUser.resetPasswordExpires = null;
            await testUser.save();

            const savedUser = await db.User.unscoped().findOne({ 
                where: { email: TEST_USERS.VALID_ADMIN.email } 
            });
            expect(savedUser).toBeDefined();
            expect(savedUser!.resetPasswordToken).toBeNull();
            expect(savedUser!.resetPasswordExpires).toBeNull();
        });

        it('should find user by reset token and check expiration', async () => {
            const resetToken = 'validhashedtoken';
            const validExpiration = new Date(Date.now() + 3600000); // 1 hour from now

            testUser.resetPasswordToken = resetToken;
            testUser.resetPasswordExpires = validExpiration;
            await testUser.save();

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

            testUser.resetPasswordToken = resetToken;
            testUser.resetPasswordExpires = expiredTime;
            await testUser.save();

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

            testUser.resetPasswordToken = resetToken;
            testUser.resetPasswordExpires = validExpiration;
            await testUser.save();

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
            const user2 = await db.User.register(TEST_USERS.VALID_MEMBER, TEST_PASSWORDS.VALID);

            const token1 = 'hashedtoken1';
            const token2 = 'hashedtoken2';
            const validExpiration = new Date(Date.now() + 3600000);

            testUser.resetPasswordToken = token1;
            testUser.resetPasswordExpires = validExpiration;
            await testUser.save();

            user2.resetPasswordToken = token2;
            user2.resetPasswordExpires = validExpiration;
            await user2.save();

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
            expect(foundUser1!.id).not.toBe(foundUser2!.id);
        });
    });

    describe('Default Scope Behavior', () => {
        let testUser: any;

        beforeEach(async () => {
            testUser = await db.User.register(TEST_USERS.VALID_ADMIN, TEST_PASSWORDS.VALID);
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
            
            await expect(db.User.register(userWithoutUsername, TEST_PASSWORDS.VALID))
                .rejects.toThrow();
        });

        it('should require email field', async () => {
            const userWithoutEmail = {
                username: 'noemail',
                role: UserRole.USER
            };
            
            await expect(db.User.register(userWithoutEmail, TEST_PASSWORDS.VALID))
                .rejects.toThrow();
        });

        it('should validate email format', async () => {
            const userWithInvalidEmail = {
                username: 'testuser',
                email: 'not-an-email',
                role: UserRole.USER
            };
            
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
            
            const user = await db.User.register(userWithOAuth, TEST_PASSWORDS.VALID);
            expect(user.oauthID).toBe('123456789');
            expect(user.oauthProvider).toBe('google');
            expect(user.oauthProfile).toEqual(userWithOAuth.oauthProfile);
        });
    });
});
