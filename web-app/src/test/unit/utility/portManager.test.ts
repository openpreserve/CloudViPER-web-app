import { getAvailablePort, isPortAvailable, getMultipleAvailablePorts } from '../../../utility/portManager';
import * as net from 'net';

describe('Port Manager Utility', () => {
    afterEach(() => {
        // Clean up any open servers
        jest.clearAllMocks();
    });

    describe('getAvailablePort', () => {
        it('should return an available port', async () => {
            const port = await getAvailablePort(3001);
            expect(port).toBeGreaterThanOrEqual(3001);
            expect(port).toBeLessThanOrEqual(65535);
        });

        it('should return a port within the specified range', async () => {
            const port = await getAvailablePort(5000, 5010);
            expect(port).toBeGreaterThanOrEqual(5000);
            expect(port).toBeLessThanOrEqual(5010);
        });

        it('should skip ports that are in use', async () => {
            // Create a server on port 4000
            const testServer = net.createServer();
            await new Promise<void>((resolve) => {
                testServer.listen(4000, '127.0.0.1', resolve);
            });

            try {
                // Should return 4001 or higher since 4000 is occupied
                const port = await getAvailablePort(4000, 4010);
                expect(port).toBeGreaterThan(4000);
            } finally {
                testServer.close();
            }
        });

        it('should reject if no ports are available in range', async () => {
            // Try a very narrow range that's likely to fail
            await expect(getAvailablePort(65534, 65534)).rejects.toThrow('No available ports found');
        });
    });

    describe('isPortAvailable', () => {
        it('should return true for an available port', async () => {
            const available = await isPortAvailable(3999);
            expect(available).toBe(true);
        });

        it('should return false for a port in use', async () => {
            // Create a server on port 3998
            const testServer = net.createServer();
            await new Promise<void>((resolve) => {
                testServer.listen(3998, '127.0.0.1', resolve);
            });

            try {
                const available = await isPortAvailable(3998);
                expect(available).toBe(false);
            } finally {
                testServer.close();
            }
        });
    });

    describe('getMultipleAvailablePorts', () => {
        it('should return multiple available ports', async () => {
            const ports = await getMultipleAvailablePorts(3, 6000);
            
            expect(ports).toHaveLength(3);
            expect(ports[0]).toBeGreaterThanOrEqual(6000);
            expect(ports[1]).toBeGreaterThan(ports[0]);
            expect(ports[2]).toBeGreaterThan(ports[1]);
            
            // All ports should be unique
            const uniquePorts = new Set(ports);
            expect(uniquePorts.size).toBe(3);
        });

        it('should return sequential available ports', async () => {
            const ports = await getMultipleAvailablePorts(2, 7000);
            
            expect(ports).toHaveLength(2);
            // Ports should be in ascending order
            expect(ports[1]).toBeGreaterThan(ports[0]);
        });
    });

    describe('Stress Testing Capabilities', () => {
        it('should handle multiple simultaneous port requests', async () => {
            const promises = Array.from({ length: 5 }, () => getAvailablePort(8000));
            const ports = await Promise.all(promises);
            
            // All ports should be unique
            const uniquePorts = new Set(ports);
            expect(uniquePorts.size).toBe(5);
            
            // All ports should be valid
            ports.forEach(port => {
                expect(port).toBeGreaterThanOrEqual(8000);
                expect(port).toBeLessThanOrEqual(65535);
            });
        });

        it('should work for development stress testing scenario', async () => {
            // Simulate creating 10 Docker instances simultaneously
            const instanceCount = 10;
            const startPort = 9000;
            
            const ports = await getMultipleAvailablePorts(instanceCount, startPort);
            
            expect(ports).toHaveLength(instanceCount);
            
            // Verify all ports are unique and in valid range
            const uniquePorts = new Set(ports);
            expect(uniquePorts.size).toBe(instanceCount);
            
            ports.forEach(port => {
                expect(port).toBeGreaterThanOrEqual(startPort);
            });
            
            console.log(`Stress test: Got ${instanceCount} ports:`, ports);
        });
    });
});
