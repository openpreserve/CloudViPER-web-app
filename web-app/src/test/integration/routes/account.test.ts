import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import accountRouter from '../../../routes/account';
import User from '../../../models/user';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Mock the dependencies
jest.mock('../../../utility/emailRelay', () => ({
  sendResetEmail: jest.fn().mockResolvedValue(true),
  sendInvitedEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../../utility/helperFunctions', () => ({
  generateUsername: jest.fn((email: string) => email.split('@')[0]),
  generateRandomString: jest.fn(() => 'mockedRandomString'),
  sanitizeUsername: jest.fn((username: string) => username)
}));

// Mock the database models
jest.mock('../../../models/', () => ({
  User: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    register: jest.fn(),
    update: jest.fn()
  }
}));

// Mock mysql2
jest.mock('mysql2', () => ({
  createConnection: jest.fn()
}));

// Mock passport
jest.mock('passport', () => ({
  authenticate: jest.fn(() => (req: any, res: any, next: any) => next())
}));

describe('Account Routes - Password Reset Integration Tests', () => {
  let app: express.Application;
  let mockUser: any;

  beforeAll(async () => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock session and flash middleware
    app.use((req: any, res: any, next: any) => {
      req.flash = jest.fn().mockReturnValue([]);
      next();
    });

    // Mock template rendering
    app.engine('handlebars', (filePath: string, options: any, callback: any) => {
      callback(null, `<html><body>Mocked template: ${path.basename(filePath)}</body></html>`);
    });
    app.set('view engine', 'handlebars');

    app.use('/account', accountRouter);

    // Setup mock user
    mockUser = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      resetPasswordToken: null,
      resetPasswordExpires: null,
      update: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true),
      setPassword: jest.fn().mockResolvedValue(true)
    };
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock behavior
    const db = require('../../../models/');
    db.User.findOne.mockResolvedValue(mockUser);
  });

  describe('POST /account/reset-password', () => {
    it('should generate and hash reset token for valid email', async () => {
      const response = await request(app)
        .post('/account/reset-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);

      // Verify token was hashed and stored
      expect(mockUser.update).toHaveBeenCalledWith({
        resetPasswordToken: expect.any(String),
        resetPasswordExpires: expect.any(Number)
      });
    });

    it('should handle non-existent email without revealing user existence', async () => {
      // Mock no user found
      const db = require('../../../models/');
      db.User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/account/reset-password')
        .send({ email: 'nonexistent@example.com' });

      // Should return same response regardless of email existence (security)
      expect(response.status).toBe(200);
    });

    it('should generate different hashed tokens for multiple requests', async () => {
      let tokenCalls: any[] = [];
      
      // Capture the tokens being stored
      mockUser.update.mockImplementation((data: any) => {
        tokenCalls.push(data.resetPasswordToken);
        return Promise.resolve(true);
      });

      // First request
      await request(app)
        .post('/account/reset-password')
        .send({ email: 'test@example.com' });

      // Second request
      await request(app)
        .post('/account/reset-password')
        .send({ email: 'test@example.com' });

      expect(tokenCalls).toHaveLength(2);
      expect(tokenCalls[0]).not.toBe(tokenCalls[1]);
    });
  });

  describe('GET /account/reset-token/:token', () => {
    let plainToken: string;
    let hashedToken: string;

    beforeEach(async () => {
      // Generate token and hash (simulating the POST reset-password flow)
      plainToken = crypto.randomBytes(32).toString('hex');
      hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');

      // Setup mock user with valid token
      mockUser.resetPasswordToken = hashedToken;
      mockUser.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
      
      const db = require('../../../models/');
      db.User.findOne.mockImplementation(({ where }: any) => {
        if (where.resetPasswordToken === hashedToken && where.resetPasswordExpires) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      });
    });

    it('should accept valid unhashed token and render reset form', async () => {
      const response = await request(app)
        .get(`/account/reset-token/${plainToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject invalid token', async () => {
      const invalidToken = crypto.randomBytes(32).toString('hex');
      
      const response = await request(app)
        .get(`/account/reset-token/${invalidToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Password reset token is invalid or has expired.');
    });

    it('should reject expired token', async () => {
      // Mock expired token scenario
      const db = require('../../../models/');
      db.User.findOne.mockResolvedValue(null); // No user found due to expiration

      const response = await request(app)
        .get(`/account/reset-token/${plainToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Password reset token is invalid or has expired.');
    });

    it('should not accept hashed token as if it were plain text', async () => {
      // Try to use the hashed token as if it were plain text
      const response = await request(app)
        .get(`/account/reset-token/${hashedToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Password reset token is invalid or has expired.');
    });
  });

  describe('Security Tests', () => {
    it('should never store plain text tokens in database', async () => {
      const originalRandomBytes = crypto.randomBytes;
      const testToken = 'predictabletoken123';
      
      // Mock crypto.randomBytes to return predictable value
      crypto.randomBytes = jest.fn().mockImplementation((size: number) => {
        return Buffer.from(testToken, 'utf8');
      });

      await request(app)
        .post('/account/reset-password')
        .send({ email: 'test@example.com' });

      const expectedHash = crypto.createHash('sha256').update(testToken).digest('hex');

      // Verify the mock was called with hashed token, not plain text
      expect(mockUser.update).toHaveBeenCalledWith({
        resetPasswordToken: expectedHash,
        resetPasswordExpires: expect.any(Number)
      });

      // Restore original function
      crypto.randomBytes = originalRandomBytes;
    });

    it('should use cryptographically secure token generation', async () => {
      const cryptoSpy = jest.spyOn(crypto, 'randomBytes');

      await request(app)
        .post('/account/reset-password')
        .send({ email: 'test@example.com' });

      expect(cryptoSpy).toHaveBeenCalledWith(32); // 32 bytes = 256 bits
      cryptoSpy.mockRestore();
    });

    it('should use SHA-256 for token hashing', async () => {
      const createHashSpy = jest.spyOn(crypto, 'createHash');

      await request(app)
        .post('/account/reset-password')
        .send({ email: 'test@example.com' });

      expect(createHashSpy).toHaveBeenCalledWith('sha256');
      createHashSpy.mockRestore();
    });
  });
});
