// Test setup file to handle common configuration
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables for testing
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set test timeout globally
jest.setTimeout(30000);

// Mock get-port to avoid ES module issues
jest.mock('get-port', () => {
    return jest.fn().mockResolvedValue(3001);
});
