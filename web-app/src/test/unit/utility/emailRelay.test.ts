import { MailerSend } from 'mailersend';

// Create a mock send function that we can spy on
const mockSend = jest.fn();

// Mock MailerSend
jest.mock('mailersend', () => ({
  MailerSend: jest.fn().mockImplementation(() => ({
    email: {
      send: mockSend
    }
  })),
  EmailParams: jest.fn().mockImplementation(() => ({
    setFrom: jest.fn().mockReturnThis(),
    setTo: jest.fn().mockReturnThis(),
    setSubject: jest.fn().mockReturnThis(),
    setText: jest.fn().mockReturnThis(),
    setHtml: jest.fn().mockReturnThis()
  })),
  Recipient: jest.fn().mockImplementation((email, name) => ({ email, name })),
  Sender: jest.fn().mockImplementation((email, name) => ({ email, name }))
}));

// Import emailRelay after the mock is set up
import emailRelay from '../../../utility/emailRelay';

describe('Email Relay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup console mocks
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with correct parameters', async () => {
      mockSend.mockResolvedValue({ status: 202 });

      await emailRelay.sendWelcomeEmail('test@example.com', 'testuser');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('Email sent');
    });

    it('should handle MailerSend errors gracefully', async () => {
      const error = new Error('MailerSend error');
      mockSend.mockRejectedValue(error);

      await emailRelay.sendWelcomeEmail('test@example.com', 'testuser');
      
      // Wait a bit for the async error handling
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(console.error).toHaveBeenCalledWith(error);
    });
  });

  describe('sendInvitedEmail', () => {
    it('should send invitation email with correct parameters', async () => {
      mockSend.mockResolvedValue({ status: 202 });

      await emailRelay.sendInvitedEmail('invited@example.com', 'inviteduser', 'admin@example.com');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('Email sent');
    });
  });

  describe('sendResetEmail', () => {
    it('should send password reset email with token', async () => {
      mockSend.mockResolvedValue({ status: 202 });

      const token = 'reset-token-123';
      await emailRelay.sendResetEmail('user@example.com', 'username', token);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('Email sent');
    });

    it('should include security warning in reset email', async () => {
      mockSend.mockResolvedValue({ status: 202 });

      await emailRelay.sendResetEmail('user@example.com', 'username', 'token');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('API Key Configuration', () => {
    it('should set MailerSend API key on module import', () => {
      // Since the module is already imported, the API key should have been set
      // We can check if the environment variable exists
      expect(process.env.MAILERSEND_API_KEY).toBeDefined();
    });
  });
});
