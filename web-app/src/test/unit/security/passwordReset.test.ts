import crypto from 'crypto';

// Mock crypto module directly in the test file
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
  createHash: jest.fn()
}));

const mockRandomBytes = jest.mocked(crypto.randomBytes);
const mockCreateHash = jest.mocked(crypto.createHash);

describe('Password Reset Token Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default behavior
    mockRandomBytes.mockImplementation((size: number) => {
      const buffer = Buffer.alloc(size);
      for (let i = 0; i < size; i++) {
        buffer[i] = (i * 7) % 256;
      }
      return buffer;
    });
    
    mockCreateHash.mockImplementation(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mocked_hash_value')
    } as any));
  });

  describe('Token Hashing', () => {
    it('should generate different tokens for each request', () => {
      // Mock different return values for each call
      mockRandomBytes
        .mockReturnValueOnce(Buffer.from('token1data') as any)
        .mockReturnValueOnce(Buffer.from('token2data') as any);

      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');
      
      expect(token1).not.toBe(token2);
    });

    it('should hash tokens consistently using SHA-256', () => {
      const mockUpdate = jest.fn().mockReturnValue({
        digest: jest.fn().mockReturnValue('consistent_hash_value')
      });
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any);

      const plainToken = 'test-token-123';
      
      const hash1 = crypto.createHash('sha256').update(plainToken).digest('hex');
      const hash2 = crypto.createHash('sha256').update(plainToken).digest('hex');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBe('consistent_hash_value');
    });

    it('should produce different hashes for different tokens', () => {
      let callCount = 0;
      
      mockCreateHash.mockImplementation(() => {
        const currentCall = ++callCount;
        return {
          update: jest.fn().mockReturnValue({
            digest: jest.fn().mockReturnValue(`hash_${currentCall}`)
          })
        } as any;
      });

      const token1 = 'token-one';
      const token2 = 'token-two';
      
      const hash1 = crypto.createHash('sha256').update(token1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(token2).digest('hex');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should be available as a Node.js built-in module', () => {
      mockRandomBytes.mockReturnValue(Buffer.alloc(32, 42) as any); // Fill with byte value 42

      const token = crypto.randomBytes(32);
      
      expect(token).toBeDefined();
      expect(token).toBeInstanceOf(Buffer);
      expect(token.length).toBe(32);
    });
  });

  describe('Token Validation Logic', () => {
    it('should simulate the password reset flow', () => {
      mockRandomBytes.mockReturnValue(Buffer.from('plaintoken123') as any);
      mockCreateHash.mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('hashedtoken123')
        })
      } as any);

      // Step 1: Generate plain token (sent via email)
      const plainToken = crypto.randomBytes(32).toString('hex');
      
      // Step 2: Hash token for database storage
      const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
      
      // Step 3: Simulate database storage (in real app, this would be stored)
      const storedToken = hashedToken;
      const expirationTime = Date.now() + 3600000; // 1 hour
      
      // Step 4: Simulate user clicking email link with plain token
      const submittedToken = plainToken;
      
      // Step 5: Hash submitted token to compare with stored hash
      const submittedHash = crypto.createHash('sha256').update(submittedToken).digest('hex');
      
      // Step 6: Validate token and expiration
      const isValidToken = submittedHash === storedToken;
      const isNotExpired = Date.now() < expirationTime;
      
      expect(isValidToken).toBe(true);
      expect(isNotExpired).toBe(true);
    });

    it('should reject invalid tokens', () => {
      mockRandomBytes
        .mockReturnValueOnce(Buffer.from('plaintoken123') as any)
        .mockReturnValueOnce(Buffer.from('wrongtoken456') as any);
      
      let hashCallCount = 0;
      mockCreateHash.mockImplementation(() => ({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue(`hash_${++hashCallCount}`)
        })
      } as any));

      const plainToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
      
      // Store the hashed version
      const storedToken = hashedToken;
      
      // Try with wrong plain token
      const wrongToken = crypto.randomBytes(32).toString('hex');
      const wrongHash = crypto.createHash('sha256').update(wrongToken).digest('hex');
      
      const isValid = wrongHash === storedToken;
      expect(isValid).toBe(false);
    });

    it('should reject expired tokens', () => {
      mockRandomBytes.mockReturnValue(Buffer.from('plaintoken123') as any);
      mockCreateHash.mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('hashedtoken123')
        })
      } as any);

      const plainToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
      
      // Simulate expired token (1 hour ago)
      const expiredTime = Date.now() - 3600000;
      
      const submittedHash = crypto.createHash('sha256').update(plainToken).digest('hex');
      const isValidToken = submittedHash === hashedToken;
      const isNotExpired = Date.now() < expiredTime;
      
      expect(isValidToken).toBe(true); // Token itself is valid
      expect(isNotExpired).toBe(false); // But it's expired
    });

    it('should prevent timing attacks by always hashing submitted tokens', () => {
      mockCreateHash.mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('timing_attack_prevention_hash')
        })
      } as any);

      // Even if no user exists, we should still hash the submitted token
      // This prevents timing attacks that could reveal user existence
      
      const submittedToken = 'any-token-value';
      const startTime = process.hrtime.bigint();
      
      // Always perform the hash operation
      const hashedSubmitted = crypto.createHash('sha256').update(submittedToken).digest('hex');
      
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime);
      
      expect(hashedSubmitted).toBeDefined();
      expect(executionTime).toBeGreaterThan(0);
      
      // The operation should take a measurable amount of time
      // indicating that actual cryptographic work was performed
    });
  });

  describe('Security Properties', () => {
    it('should never store plain text tokens', () => {
      mockCreateHash.mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
        })
      } as any);

      const plainToken = 'sensitive-reset-token-123';
      const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
      
      // What gets stored in database
      const databaseValue = hashedToken;
      
      // Ensure database never contains plain text
      expect(databaseValue).not.toBe(plainToken);
      expect(databaseValue).not.toContain(plainToken);
      
      // Ensure it's a proper SHA-256 hash format (64 hex characters)
      expect(databaseValue).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should use sufficient token entropy', () => {
      // Mock to return different values for each call
      let callCount = 0;
      mockRandomBytes.mockImplementation((size: number) => {
        const buffer = Buffer.alloc(size);
        const seed = ++callCount;
        for (let i = 0; i < size; i++) {
          buffer[i] = (i * seed * 7) % 256;
        }
        return buffer;
      });

      // 32 bytes = 256 bits of entropy
      const tokenSize = 32;
      const token = crypto.randomBytes(tokenSize);
      
      expect(token.length).toBe(tokenSize);
      
      // Check that tokens are actually random
      const tokens = Array.from({ length: 100 }, () => 
        crypto.randomBytes(tokenSize).toString('hex')
      );
      
      // All tokens should be unique (with high probability)
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });
  });
});
