import helperFunctions from '../../../utility/helperFunctions';

describe('Helper Functions', () => {
  describe('sanitizeUsername', () => {
    it('should convert to lowercase and remove special characters', () => {
      expect(helperFunctions.sanitizeUsername('User@Name!')).toBe('username');
      expect(helperFunctions.sanitizeUsername('Test_User-123')).toBe('testuser123');
      expect(helperFunctions.sanitizeUsername('UPPERCASE')).toBe('uppercase');
    });

    it('should handle empty strings', () => {
      expect(helperFunctions.sanitizeUsername('')).toBe('');
    });

    it('should handle strings with only special characters', () => {
      expect(helperFunctions.sanitizeUsername('@#$%')).toBe('');
    });
  });

  describe('generateUsername', () => {
    it('should extract username from email', () => {
      expect(helperFunctions.generateUsername('john.doe@example.com')).toBe('johndoe');
      expect(helperFunctions.generateUsername('test_user@domain.org')).toBe('testuser');
    });

    it('should handle email without @ symbol', () => {
      expect(helperFunctions.generateUsername('username')).toBe('username');
    });

    it('should handle emails with special characters', () => {
      expect(helperFunctions.generateUsername('user+tag@example.com')).toBe('usertag');
    });

    it('should handle empty strings', () => {
      expect(helperFunctions.generateUsername('')).toBe('');
    });
  });

  describe('updateRoleIfAdmin', () => {
    it('should return admin for openpreservation.org domain', () => {
      expect(helperFunctions.updateRoleIfAdmin('admin@openpreservation.org')).toBe('admin');
      expect(helperFunctions.updateRoleIfAdmin('user@openpreservation.org')).toBe('admin');
    });

    it('should return user for other domains', () => {
      expect(helperFunctions.updateRoleIfAdmin('user@example.com')).toBe('user');
      expect(helperFunctions.updateRoleIfAdmin('admin@other.org')).toBe('user');
    });

    it('should handle emails without domain', () => {
      expect(helperFunctions.updateRoleIfAdmin('user')).toBe('user');
    });
  });

  describe('generateRandomString', () => {
    it('should generate string of specified length', () => {
      const result = helperFunctions.generateRandomString(10);
      expect(result).toHaveLength(10);
    });

    it('should generate different strings on multiple calls', () => {
      const result1 = helperFunctions.generateRandomString(8);
      const result2 = helperFunctions.generateRandomString(8);
      expect(result1).not.toBe(result2);
    });

    it('should only contain allowed characters', () => {
      const result = helperFunctions.generateRandomString(20);
      expect(result).toMatch(/^[a-z0-9]+$/);
    });

    it('should handle zero length', () => {
      expect(helperFunctions.generateRandomString(0)).toBe('');
    });
  });
});
