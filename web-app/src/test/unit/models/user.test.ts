import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import User from '../../../models/user';
import path from 'path';

const result = dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('User Model', () => {
  let sequelizeInstance: Sequelize;
  let userModel: any;

  beforeAll(async () => {
    sequelizeInstance = new Sequelize(
      process.env.DB_NAME!,
      process.env.DB_USER!,
      process.env.DB_PASSWORD!,
      {
        host: process.env.DB_HOST!,
        dialect: 'mysql',
        logging: false,
      }
    );

    await sequelizeInstance.authenticate();
    
    // Initialize the User model
    userModel = User(sequelizeInstance);
    
    // Sync the database to create tables
    await sequelizeInstance.sync({ force: true });
  });

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

  afterAll(async () => {
    await sequelizeInstance.close();
  });
});
