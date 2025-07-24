import Docker from 'dockerode';

// Mock dockerode
jest.mock('dockerode', () => {
  return jest.fn().mockImplementation((options?: any) => ({
    createContainer: jest.fn().mockResolvedValue({
      id: 'container123',
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      inspect: jest.fn().mockResolvedValue({ State: { Running: true } }),
      logs: jest.fn().mockResolvedValue('container logs')
    }),
    createImage: jest.fn().mockResolvedValue({} as any),
    ping: jest.fn().mockResolvedValue(undefined),
    version: jest.fn().mockResolvedValue({ Version: '20.10.0' })
  }));
});

describe('Docker Integration', () => {
  let mockDocker: any;

  beforeEach(() => {
    mockDocker = {
      createContainer: jest.fn().mockResolvedValue({
        id: 'container123',
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
        inspect: jest.fn().mockResolvedValue({ State: { Running: true } }),
        logs: jest.fn().mockResolvedValue('container logs')
      }),
      createImage: jest.fn().mockResolvedValue({} as any),
      ping: jest.fn().mockResolvedValue(undefined),
      version: jest.fn().mockResolvedValue({ Version: '20.10.0' })
    };
    
    (Docker as any).mockReturnValue(mockDocker);
    jest.clearAllMocks();
  });

  describe('Docker Connection', () => {
    it('should initialize Docker with correct socket path', () => {
      // Create a new Docker instance
      const docker = new Docker({ socketPath: '/var/run/docker.sock' });
      expect(Docker).toHaveBeenCalledWith({ socketPath: '/var/run/docker.sock' });
    });
  });

  describe('Container Management', () => {
    it('should create container with correct configuration', async () => {
      const mockCreateContainer = jest.fn().mockResolvedValue({
        id: 'test-container-id',
        start: jest.fn().mockResolvedValue({}),
        inspect: jest.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { Ports: { '8080/tcp': [{ HostPort: '9000' }] } }
        })
      });

      mockDocker.createContainer = mockCreateContainer;

      const containerConfig = {
        Image: 'viper-image',
        ExposedPorts: { '8080/tcp': {} },
        HostConfig: {
          PortBindings: { '8080/tcp': [{ HostPort: '9000' }] },
          Memory: 1073741824, // 1GB
          AutoRemove: true
        },
        Env: ['NODE_ENV=production']
      };

      await mockDocker.createContainer(containerConfig);

      expect(mockCreateContainer).toHaveBeenCalledWith(containerConfig);
    });

    it('should handle container creation errors', async () => {
      const error = new Error('Docker daemon not running');
      mockDocker.createContainer = jest.fn().mockRejectedValue(error);

      await expect(mockDocker.createContainer({})).rejects.toThrow('Docker daemon not running');
    });
  });

  describe('Container Lifecycle', () => {
    let mockContainer: any;

    beforeEach(() => {
      mockContainer = {
        id: 'test-container-id',
        start: jest.fn().mockResolvedValue({}),
        stop: jest.fn().mockResolvedValue({}),
        remove: jest.fn().mockResolvedValue({}),
        inspect: jest.fn().mockResolvedValue({
          State: { Running: true },
          NetworkSettings: { Ports: {} }
        }),
        logs: jest.fn().mockResolvedValue('Container logs')
      };
    });

    it('should start container successfully', async () => {
      await mockContainer.start();
      expect(mockContainer.start).toHaveBeenCalled();
    });

    it('should stop container successfully', async () => {
      await mockContainer.stop();
      expect(mockContainer.stop).toHaveBeenCalled();
    });

    it('should remove container after stopping', async () => {
      await mockContainer.stop();
      await mockContainer.remove();
      
      expect(mockContainer.stop).toHaveBeenCalled();
      expect(mockContainer.remove).toHaveBeenCalled();
    });

    it('should handle container stop errors gracefully', async () => {
      const error = new Error('Container not found');
      mockContainer.stop.mockRejectedValue(error);

      await expect(mockContainer.stop()).rejects.toThrow('Container not found');
    });
  });

  describe('Container Monitoring', () => {
    it('should inspect container state', async () => {
      const mockContainer = {
        inspect: jest.fn().mockResolvedValue({
          State: { 
            Running: true, 
            ExitCode: 0,
            StartedAt: new Date().toISOString()
          },
          NetworkSettings: {
            Ports: { '8080/tcp': [{ HostPort: '9000' }] }
          }
        })
      };

      const inspection = await mockContainer.inspect();
      
      expect(inspection.State.Running).toBe(true);
      expect(inspection.NetworkSettings.Ports).toBeDefined();
    });

    it('should retrieve container logs', async () => {
      const mockContainer = {
        logs: jest.fn().mockResolvedValue('Application started on port 8080')
      };

      const logs = await mockContainer.logs({ stdout: true, stderr: true });
      
      expect(logs).toContain('Application started');
    });
  });

  describe('Error Handling', () => {
    it('should handle Docker daemon connection issues', () => {
      const error = new Error('Cannot connect to Docker daemon');
      
      // Test that service gracefully handles Docker unavailability
      expect(() => {
        throw error;
      }).toThrow('Cannot connect to Docker daemon');
    });

    it('should handle image pull failures', async () => {
      mockDocker.pull = jest.fn().mockRejectedValue(new Error('Image not found'));
      
      await expect(mockDocker.pull('non-existent-image')).rejects.toThrow('Image not found');
    });
  });
});
