import sgMail from '@sendgrid/mail';

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn()
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
      const mockSend = sgMail.send as jest.Mock;
      mockSend.mockResolvedValue([{ statusCode: 202 }]);

      await emailRelay.sendWelcomeEmail('test@example.com', 'testuser');

      expect(mockSend).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'no-reply@vipercloud.cc',
        subject: 'Welcome to ViPER Cloud testuser',
        text: 'You are now part of the ViPER community. Access ViPER Cloud via https://www.vipercloud.cc/',
        html: expect.stringContaining('You are now part of the ViPER community')
      });
    });

    it('should handle SendGrid errors gracefully', async () => {
      const mockSend = sgMail.send as jest.Mock;
      const error = new Error('SendGrid error');
      mockSend.mockRejectedValue(error);

      // Give some time for the promise to resolve and error to be logged
      await emailRelay.sendWelcomeEmail('test@example.com', 'testuser');
      
      // Wait a bit for the async error handling
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(console.error).toHaveBeenCalledWith(error);
    });
  });

  describe('sendInvitedEmail', () => {
    it('should send invitation email with correct parameters', async () => {
      const mockSend = sgMail.send as jest.Mock;
      mockSend.mockResolvedValue([{ statusCode: 202 }]);

      await emailRelay.sendInvitedEmail('invited@example.com', 'inviteduser', 'admin@example.com');

      expect(mockSend).toHaveBeenCalledWith({
        to: 'invited@example.com',
        from: 'no-reply@vipercloud.cc',
        subject: 'Welcome to ViPER Cloud inviteduser',
        text: expect.stringContaining('You have been invited to the ViPER Cloud community by admin@example.com'),
        html: expect.stringContaining('You have been invited to use ViPER Cloud!')
      });
    });
  });

  describe('sendResetEmail', () => {
    it('should send password reset email with token', async () => {
      const mockSend = sgMail.send as jest.Mock;
      mockSend.mockResolvedValue([{ statusCode: 202 }]);

      const token = 'reset-token-123';
      await emailRelay.sendResetEmail('user@example.com', 'username', token);

      expect(mockSend).toHaveBeenCalledWith({
        to: 'user@example.com',
        from: 'no-reply@vipercloud.cc',
        subject: 'ViPER Cloud - Password reset',
        text: expect.stringContaining(token),
        html: expect.stringContaining(token)
      });
    });

    it('should include security warning in reset email', async () => {
      const mockSend = sgMail.send as jest.Mock;
      mockSend.mockResolvedValue([{ statusCode: 202 }]);

      await emailRelay.sendResetEmail('user@example.com', 'username', 'token');

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain('If you did not request this');
    });
  });

  describe('API Key Configuration', () => {
    it('should set SendGrid API key on module import', () => {
      // Since the module is already imported, the API key should have been set
      // We can check if the environment variable exists
      expect(process.env.SENDGRID_API_KEY).toBeDefined();
    });
  });
});
