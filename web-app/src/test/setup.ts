// Mock get-port to avoid ES module issues
jest.mock('get-port', () => {
    return jest.fn().mockResolvedValue(3001);
});
