import auth from '../../../config/auth';

describe('Auth Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('googleAuth configuration', () => {
    it('should have correct structure', () => {
      expect(auth.googleAuth).toHaveProperty('clientID');
      expect(auth.googleAuth).toHaveProperty('clientSecret');
      expect(auth.googleAuth).toHaveProperty('callbackURL');
    });

    it('should use environment variables for Google auth', () => {
      process.env.GOOGLE_AUTH_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_AUTH_CLIENT_SECRET = 'test-client-secret';
      
      // Re-import to get updated config
      jest.resetModules();
      const authConfig = require('../../../config/auth').default;
      
      expect(authConfig.googleAuth.clientID).toBe('test-client-id');
      expect(authConfig.googleAuth.clientSecret).toBe('test-client-secret');
    });

    it('should have correct callback URL', () => {
      expect(auth.googleAuth.callbackURL).toBe('https://www.vipercloud.cc/account/google/return/');
    });

    it('should handle environment configuration properly', () => {
      // Test that environment variables are being used when available
      expect(typeof auth.googleAuth.clientID).toBe('string');
      expect(typeof auth.googleAuth.clientSecret).toBe('string');
    });
  });

  describe('mysqlSessionAuth configuration', () => {
    it('should have correct structure', () => {
      expect(auth.mysqlSessionAuth).toHaveProperty('host');
      expect(auth.mysqlSessionAuth).toHaveProperty('port');
      expect(auth.mysqlSessionAuth).toHaveProperty('user');
      expect(auth.mysqlSessionAuth).toHaveProperty('password');
      expect(auth.mysqlSessionAuth).toHaveProperty('database');
    });

    it('should use environment variables for database config', () => {
      process.env.DB_HOST = 'test-host';
      process.env.DB_USER = 'test-user';
      process.env.DB_PASSWORD = 'test-password';
      process.env.DB_NAME = 'test-database';
      
      jest.resetModules();
      const authConfig = require('../../../config/auth').default;
      
      expect(authConfig.mysqlSessionAuth.host).toBe('test-host');
      expect(authConfig.mysqlSessionAuth.user).toBe('test-user');
      expect(authConfig.mysqlSessionAuth.password).toBe('test-password');
      expect(authConfig.mysqlSessionAuth.database).toBe('test-database');
    });

    it('should have default port 3306', () => {
      expect(auth.mysqlSessionAuth.port).toBe(3306);
    });

    it('should handle database environment configuration properly', () => {
      // Test that environment variables are being used when available
      expect(typeof auth.mysqlSessionAuth.host).toBe('string');
      expect(typeof auth.mysqlSessionAuth.user).toBe('string');
      expect(typeof auth.mysqlSessionAuth.password).toBe('string');
      expect(typeof auth.mysqlSessionAuth.database).toBe('string');
      expect(auth.mysqlSessionAuth.port).toBe(3306);
    });
  });
});
