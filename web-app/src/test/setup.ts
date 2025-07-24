// Test setup file to handle common configuration
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables for testing
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set test environment variables
process.env.MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY || 'test-mailersend-key';
process.env.GOOGLE_AUTH_CLIENT_ID = process.env.GOOGLE_AUTH_CLIENT_ID || 'test_client_id';
process.env.GOOGLE_AUTH_CLIENT_SECRET = process.env.GOOGLE_AUTH_CLIENT_SECRET || 'test_client_secret';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_USER = process.env.DB_USER || 'viper_root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'viper_pass';
process.env.DB_NAME = process.env.DB_NAME || 'viper_db_test';

// Set test timeout globally
jest.setTimeout(30000);

// Mock get-port to avoid ES module issues
jest.mock('get-port', () => {
    return jest.fn().mockResolvedValue(3001);
});
