import * as net from 'net';

/**
 * Find an available port on the system
 * @param startPort - Starting port to check (default: 3001)
 * @param endPort - Ending port to check (default: 65535)
 * @returns Promise<number> - Available port number
 */
export async function getAvailablePort(startPort: number = 3001, endPort: number = 65535): Promise<number> {
    return new Promise((resolve, reject) => {
        const checkPort = (port: number) => {
            if (port > endPort) {
                reject(new Error(`No available ports found between ${startPort} and ${endPort}`));
                return;
            }

            const server = net.createServer();
            
            server.listen(port, '127.0.0.1', () => {
                const availablePort = port;
                server.close(() => {
                    resolve(availablePort);
                });
            });

            server.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    // Port is in use, try the next one
                    checkPort(port + 1);
                } else {
                    reject(err);
                }
            });
        };

        checkPort(startPort);
    });
}

/**
 * Check if a specific port is available
 * @param port - Port number to check
 * @returns Promise<boolean> - True if port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.listen(port, '127.0.0.1', () => {
            server.close(() => {
                resolve(true);
            });
        });

        server.on('error', () => {
            resolve(false);
        });
    });
}

/**
 * Get multiple available ports
 * @param count - Number of ports needed
 * @param startPort - Starting port to check (default: 3001)
 * @returns Promise<number[]> - Array of available port numbers
 */
export async function getMultipleAvailablePorts(count: number, startPort: number = 3001): Promise<number[]> {
    const ports: number[] = [];
    let currentPort = startPort;

    for (let i = 0; i < count; i++) {
        const availablePort = await getAvailablePort(currentPort);
        ports.push(availablePort);
        currentPort = availablePort + 1; // Start next search from next port
    }

    return ports;
}

export default {
    getAvailablePort,
    isPortAvailable,
    getMultipleAvailablePorts
};
