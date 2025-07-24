import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import User from '../../../models/user';
import path from 'path';

const result = dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('User Model', () => {
  let sequelizeInstance: Sequelize;
  let userModel: any;

  beforeAll(async () => {
    // Add timeout for this operation
    jest.setTimeout(60000);
    
    console.log('Setting up database connection...');
    sequelizeInstance = new Sequelize(
      process.env.DB_NAME!,
      process.env.DB_USER!,
      process.env.DB_PASSWORD!,
      {
        host: process.env.DB_HOST!,
        dialect: 'mysql',
        logging: false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      }
    );

    console.log('Testing database connection...');
    await sequelizeInstance.authenticate();
    console.log('Database connection successful');
    
    // Initialize the User model
    userModel = User(sequelizeInstance);
    
    // Sync the database to create tables
    console.log('Syncing database...');
    await sequelizeInstance.sync({ force: true });
    console.log('Database sync complete');
  }, 60000); // 60 second timeout for setup

  it('should initialize the User model', () => {
    expect(userModel).toBeDefined();
  });

  it('should register a new user', async () => {
    const userDetails = { email: 'test@example.com', username: 'testuser', role: 'user' };
    const password = 'password123';

    const user = await userModel.register(userDetails, password);
    expect(user).toBeDefined();
    expect(user.email).toBe(userDetails.email);
  });

  it('should set a password for the user', async () => {
    const user = userModel.build({ email: 'test@example.com', username: 'testuser', role: 'user' });

    await user.setPassword('password123');
    expect(user.salt).toBeDefined();
    expect(user.hash).toBeDefined();
  });

  it('should authenticate a user with correct password', async () => {
    const userDetails = { email: 'test2@example.com', username: 'testuser2', role: 'user' };
    const password = 'password123';

    const user = await userModel.register(userDetails, password);
    const authenticatedUser = await user.authenticate(password);
    expect(authenticatedUser).toBe(user);
  });

  it('should not authenticate a user with incorrect password', async () => {
    const userDetails = { email: 'test3@example.com', username: 'testuser3', role: 'user' };
    const password = 'password123';

    const user = await userModel.register(userDetails, password);
    const authenticatedUser = await user.authenticate('wrongpassword');
    expect(authenticatedUser).toBe(false);
  });

//   it('should authenticate a user using static method', async () => {
//     const userModel = User(sequelizeInstance);
//     const userDetails = { email: 'test4@example.com', username: 'testuser4', role: 'user' };
//     const password = 'password123';

//     await userModel.register(userDetails, password);
//     const authenticatedUser = await userModel.authenticateUser(userDetails.email, password);
//     expect(authenticatedUser).toBeDefined();
//   });

  // Additional tests for better coverage
  it('should throw error when registering user without email', async () => {
    const userDetails = { username: 'testuser', role: 'user' }; // No email
    const password = 'password123';

    await expect(userModel.register(userDetails, password)).rejects.toThrow('Field email is not set');
  });

  it('should throw error when registering duplicate user', async () => {
    const userDetails = { email: 'duplicate@example.com', username: 'testuser', role: 'user' };
    const password = 'password123';

    // Register first user
    await userModel.register(userDetails, password);
    
    // Try to register duplicate - this should hit line 79
    await expect(userModel.register(userDetails, password)).rejects.toThrow('User already exists with duplicate@example.com');
  });

  it('should throw error when user email becomes undefined after build', async () => {
    // This test targets the second email check in register method (line 79 area)
    const userDetails = { email: 'test@example.com', username: 'testuser', role: 'user' };
    const password = 'password123';
    
    // Mock the build method to return a user without email
    const originalBuild = userModel.build;
    userModel.build = jest.fn().mockReturnValue({
      email: undefined, // Simulate email becoming undefined
      username: 'testuser',
      role: 'user'
    });
    
    await expect(userModel.register(userDetails, password)).rejects.toThrow('Field email is not set');
    
    // Restore original method
    userModel.build = originalBuild;
  });

  it('should throw error when setting empty password', async () => {
    const user = userModel.build({ email: 'test@example.com', username: 'testuser', role: 'user' });

    await expect(user.setPassword('')).rejects.toThrow('Password argument not set!');
  });

  it('should throw error when authenticating user without salt', async () => {
    const user = userModel.build({ email: 'test@example.com', username: 'testuser', role: 'user' });
    
    await expect(user.authenticate('password123')).rejects.toThrow('Authentication not possible. No salt value stored in db!');
  });

  it('should authenticate a user using static method', async () => {
    const userDetails = { email: 'static@example.com', username: 'staticuser', role: 'user' };
    const password = 'password123';

    await userModel.register(userDetails, password);
    const authenticatedUser = await userModel.authenticateUser(userDetails.email, password);
    expect(authenticatedUser).toBeDefined();
    expect((authenticatedUser as any).email).toBe(userDetails.email);
  });

  it('should return false when authenticating non-existent user with static method', async () => {
    const authenticatedUser = await userModel.authenticateUser('nonexistent@example.com', 'password123');
    expect(authenticatedUser).toBe(false);
  });

  it('should handle database errors gracefully in authenticateUser', async () => {
    // Spy on console.error to verify error logging
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock the unscoped method to return an object with a findOne that throws
    const originalUnscoped = userModel.unscoped;
    userModel.unscoped = jest.fn().mockReturnValue({
      findOne: jest.fn().mockRejectedValue(new Error('Database connection failed'))
    });
    
    const result = await userModel.authenticateUser('test@example.com', 'password123');
    
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Authentication Error:', expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith('Authentication Error:', expect.objectContaining({
      message: 'Database connection failed'
    }));
    
    // Restore original methods
    userModel.unscoped = originalUnscoped;
    consoleSpy.mockRestore();
  });

  // Password Reset Token Tests
  describe('Password Reset Token functionality', () => {
    it('should store reset password token and expiration', async () => {
      const userDetails = { email: 'reset@example.com', username: 'resetuser', role: 'user' };
      const password = 'password123';
      const user = await userModel.register(userDetails, password);

      const resetToken = 'hashedtokenexample';
      const expirationTime = new Date(Date.now() + 3600000); // 1 hour from now

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = expirationTime;
      await user.save();

      const savedUser = await userModel.findOne({ where: { email: userDetails.email } });
      expect(savedUser.resetPasswordToken).toBe(resetToken);
      
      // Check that dates are approximately equal (within 1 second)
      const timeDiff = Math.abs(savedUser.resetPasswordExpires.getTime() - expirationTime.getTime());
      expect(timeDiff).toBeLessThan(1000);
    });

    it('should clear reset password token after use', async () => {
      const userDetails = { email: 'clear@example.com', username: 'clearuser', role: 'user' };
      const password = 'password123';
      const user = await userModel.register(userDetails, password);

      // Set reset token
      user.resetPasswordToken = 'hashedtokenexample';
      user.resetPasswordExpires = new Date(Date.now() + 3600000);
      await user.save();

      // Clear reset token (simulating successful password reset)
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      const savedUser = await userModel.findOne({ where: { email: userDetails.email } });
      expect(savedUser.resetPasswordToken).toBeNull();
      expect(savedUser.resetPasswordExpires).toBeNull();
    });

    it('should find user by reset token and check expiration', async () => {
      const userDetails = { email: 'token@example.com', username: 'tokenuser', role: 'user' };
      const password = 'password123';
      const user = await userModel.register(userDetails, password);

      const resetToken = 'validhashedtoken';
      const validExpiration = Date.now() + 3600000; // 1 hour from now

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = validExpiration;
      await user.save();

      // Test finding user with valid token and expiration
      const foundUser = await userModel.findOne({
        where: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: { [require('sequelize').Op.gt]: Date.now() }
        }
      });

      expect(foundUser).toBeDefined();
      expect(foundUser.email).toBe(userDetails.email);
    });

    it('should not find user with expired reset token', async () => {
      const userDetails = { email: 'expired@example.com', username: 'expireduser', role: 'user' };
      const password = 'password123';
      const user = await userModel.register(userDetails, password);

      const resetToken = 'expiredhashedtoken';
      const expiredTime = Date.now() - 3600000; // 1 hour ago (expired)

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = expiredTime;
      await user.save();

      // Test finding user with expired token
      const foundUser = await userModel.findOne({
        where: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: { [require('sequelize').Op.gt]: Date.now() }
        }
      });

      expect(foundUser).toBeNull();
    });

    it('should not find user with invalid reset token', async () => {
      const userDetails = { email: 'invalid@example.com', username: 'invaliduser', role: 'user' };
      const password = 'password123';
      const user = await userModel.register(userDetails, password);

      const resetToken = 'validhashedtoken';
      const validExpiration = Date.now() + 3600000;

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = validExpiration;
      await user.save();

      // Test finding user with wrong token
      const foundUser = await userModel.findOne({
        where: {
          resetPasswordToken: 'wronghashedtoken',
          resetPasswordExpires: { [require('sequelize').Op.gt]: Date.now() }
        }
      });

      expect(foundUser).toBeNull();
    });

    it('should handle multiple users with different reset tokens', async () => {
      const user1Details = { email: 'multi1@example.com', username: 'multi1', role: 'user' };
      const user2Details = { email: 'multi2@example.com', username: 'multi2', role: 'user' };
      const password = 'password123';

      const user1 = await userModel.register(user1Details, password);
      const user2 = await userModel.register(user2Details, password);

      const token1 = 'hashedtoken1';
      const token2 = 'hashedtoken2';
      const validExpiration = Date.now() + 3600000;

      user1.resetPasswordToken = token1;
      user1.resetPasswordExpires = validExpiration;
      await user1.save();

      user2.resetPasswordToken = token2;
      user2.resetPasswordExpires = validExpiration;
      await user2.save();

      // Test finding specific users by their tokens
      const foundUser1 = await userModel.findOne({
        where: {
          resetPasswordToken: token1,
          resetPasswordExpires: { [require('sequelize').Op.gt]: Date.now() }
        }
      });

      const foundUser2 = await userModel.findOne({
        where: {
          resetPasswordToken: token2,
          resetPasswordExpires: { [require('sequelize').Op.gt]: Date.now() }
        }
      });

      expect(foundUser1.email).toBe(user1Details.email);
      expect(foundUser2.email).toBe(user2Details.email);
      expect(foundUser1.id).not.toBe(foundUser2.id);
    });
  });

  afterAll(async () => {
    console.log('Closing database connection...');
    if (sequelizeInstance) {
      await sequelizeInstance.close();
      console.log('Database connection closed');
    }
  });
});
