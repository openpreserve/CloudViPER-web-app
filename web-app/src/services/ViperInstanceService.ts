import { Request, Response } from 'express';
import path from 'path';
import { QueryTypes } from 'sequelize';
import db from '../models';
import helperFunctions from '../utility/helperFunctions';
import { getAvailablePort } from '../utility/portManager';
import { appLogger } from '../config/logger';
import { UserRole } from '../types/UserRole';
import { readAndProcessScript, validateRequiredScripts } from '../utility/scriptManager';
import { containerService } from './ContainerService';
import dotenv from 'dotenv';

dotenv.config();

const DOMAIN_NAME = process.env.DOMAIN_NAME || 'cloudviper.org';

// Interface for the user type used in service routes
export interface ServiceUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  team?: string;
  invitedById?: number;
}

/**
 * ViperInstanceService - Handles operations related to Viper instances
 */
class ViperInstanceService {
  
  /**
   * Get the base URL for the application (for constructing instance URLs)
   */
  private async getBaseUrl(): Promise<string> {
    try {
      const { getPublicUrl } = await import('../utility/detectServiceUrl');
      return await getPublicUrl();
    } catch (error) {
      // Fallback for development
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const host = process.env.APP_HOST || 'localhost:30080';
      return `${protocol}://${host}`;
    }
  }

  /**
   * Create a Kubernetes Service
   */
  private async createService(serviceSpec: any): Promise<any> {
    const { KubeConfig, CoreV1Api } = await import('@kubernetes/client-node');
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(CoreV1Api);
    const namespace = process.env.K8S_NAMESPACE || 'default';
    
    return await k8sApi.createNamespacedService({ 
      namespace, 
      body: serviceSpec 
    });
  }

  /**
   * Delete a Kubernetes Service
   */
  private async deleteService(serviceName: string): Promise<void> {
    try {
      const { KubeConfig, CoreV1Api } = await import('@kubernetes/client-node');
      const kc = new KubeConfig();
      kc.loadFromDefault();
      const k8sApi = kc.makeApiClient(CoreV1Api);
      const namespace = process.env.K8S_NAMESPACE || 'default';
      
      await k8sApi.deleteNamespacedService({ name: serviceName, namespace });
    } catch (error) {
      // Service might not exist, that's ok
      appLogger.warn('Service deletion warning', {
        eventType: 'Service Delete Warning',
        serviceName,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Create a Kubernetes Ingress for instance routing
   */
  private async createIngress(instanceUUID: string, serviceName: string): Promise<any> {
    const { KubeConfig, NetworkingV1Api } = await import('@kubernetes/client-node');
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(NetworkingV1Api);
    const namespace = process.env.K8S_NAMESPACE || 'default';
    const ingressName = `viper-ingress-${instanceUUID}`;

    // Ingress spec for path-based routing with WebSocket support
    // Using nginx ingress controller for proper WebSocket handling
    const ingressSpec = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: ingressName,
        namespace,
        labels: {
          app: 'viper-instance',
          instanceUUID
        },
        annotations: {
          // Enable WebSocket support
          'nginx.ingress.kubernetes.io/websocket-services': serviceName,
          
          // Increase timeouts for long-running WebSocket connections
          'nginx.ingress.kubernetes.io/proxy-connect-timeout': '3600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '3600',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '3600',
          
          // WebSocket specific settings (standard annotations, no snippet needed)
          'nginx.ingress.kubernetes.io/proxy-http-version': '1.1'
        }
      },
      spec: {
        ingressClassName: 'nginx',  // Use ingressClassName instead of deprecated annotation
        rules: [
          {
            http: {
              paths: [
                {
                  path: `/viper-instances/${instanceUUID}`,
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: serviceName,
                      port: {
                        number: 3000  // Service port (which routes to 8080 nginx sidecar)
                      }
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    };

    return await k8sApi.createNamespacedIngress({ namespace, body: ingressSpec });
  }

  /**
   * Create BackendConfig for GKE ingress WebSocket support
   */
  private async createBackendConfig(serviceName: string, instanceUUID: string): Promise<void> {
    try {
      const { KubeConfig, CustomObjectsApi } = await import('@kubernetes/client-node');
      const kc = new KubeConfig();
      kc.loadFromDefault();
      const k8sApi = kc.makeApiClient(CustomObjectsApi);
      const namespace = process.env.K8S_NAMESPACE || 'default';

      const backendConfigName = `${serviceName}-backendconfig`;

      const backendConfigSpec = {
        apiVersion: 'cloud.google.com/v1',
        kind: 'BackendConfig',
        metadata: {
          name: backendConfigName,
          namespace,
          labels: {
            app: 'viper-instance',
            instanceUUID
          }
        },
        spec: {
          timeoutSec: 3600,  // 1 hour timeout for long-running WebSocket connections
          connectionDraining: {
            drainingTimeoutSec: 60
          },
          sessionAffinity: {
            affinityType: 'CLIENT_IP',
            affinityCookieTtlSec: 3600
          }
        }
      };

      await k8sApi.createNamespacedCustomObject({
        group: 'cloud.google.com',
        version: 'v1',
        namespace,
        plural: 'backendconfigs',
        body: backendConfigSpec
      });

      appLogger.info('BackendConfig created', {
        eventType: 'BackendConfig Created',
        backendConfigName,
        instanceUUID,
        namespace,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      appLogger.error('Failed to create BackendConfig', {
        eventType: 'BackendConfig Creation Failed',
        serviceName,
        instanceUUID,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Delete BackendConfig
   */
  private async deleteBackendConfig(serviceName: string): Promise<void> {
    try {
      const { KubeConfig, CustomObjectsApi } = await import('@kubernetes/client-node');
      const kc = new KubeConfig();
      kc.loadFromDefault();
      const k8sApi = kc.makeApiClient(CustomObjectsApi);
      const namespace = process.env.K8S_NAMESPACE || 'default';
      const backendConfigName = `${serviceName}-backendconfig`;
      
      await k8sApi.deleteNamespacedCustomObject({
        group: 'cloud.google.com',
        version: 'v1',
        namespace,
        plural: 'backendconfigs',
        name: backendConfigName
      });
    } catch (error) {
      // BackendConfig might not exist, that's ok
      appLogger.warn('BackendConfig deletion warning', {
        eventType: 'BackendConfig Delete Warning',
        serviceName,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Delete a Kubernetes Ingress
   */
  private async deleteIngress(ingressName: string): Promise<void> {
    try {
      const { KubeConfig, NetworkingV1Api } = await import('@kubernetes/client-node');
      const kc = new KubeConfig();
      kc.loadFromDefault();
      const k8sApi = kc.makeApiClient(NetworkingV1Api);
      const namespace = process.env.K8S_NAMESPACE || 'default';
      
      await k8sApi.deleteNamespacedIngress({ name: ingressName, namespace });
    } catch (error) {
      // Ingress might not exist, that's ok
      appLogger.warn('Ingress deletion warning', {
        eventType: 'Ingress Delete Warning',
        ingressName,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Creates a new Viper instance
   */
  async createInstance(user: ServiceUser): Promise<any> {
    const ownerId = user.id;
    const instanceUUID = helperFunctions.generateRandomString(12);
    const kasmvncPassword = helperFunctions.generateRandomString(12);
    const statusKey = helperFunctions.generateRandomString(12);
    
    // Path-based URL format routed via Ingress
    // Use clean redirect URL that will forward to full VNC URL with query parameters
    const baseUrl = await this.getBaseUrl();
    const instanceURL = `${baseUrl}/service/launch/${instanceUUID}`;
    const podName = `viper-instance-${instanceUUID}`;
    const serviceName = `viper-svc-${instanceUUID}`;

    appLogger.info('Starting instance creation (Kubernetes)', {
      eventType: 'Instance Creation Started',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      instanceUUID,
      podName,
      instanceURL,
      timestamp: new Date().toISOString()
    });

    // Kubernetes Pod spec for ViPER instance
    const podSpec = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: podName,
        labels: {
          app: 'viper-instance',
          instanceUUID,
          ownerId: String(ownerId),
          'viper-instance': 'true'  // For service selector
        }
      },
      spec: {
        containers: [
          {
            name: 'viper',
            // image: process.env.VIPER_IMAGE || 'gcr.io/YOUR_PROJECT/opf-cloud-viper:latest',
            image: process.env.VIPER_IMAGE || 'australia-southeast2-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/opf-cloud-viper:docker-workshop-0.0.18',
            env: [
              { name: 'INSTANCE_UUID', value: instanceUUID },
              // { name: 'PASSWORD', value: kasmvncPassword },
              // { name: 'SUBFOLDER', value: `/viper-instances/${instanceUUID}/` }, // Don't use - nginx handles subpath routing
              { name: 'STATUS_KEY', value: statusKey },
              { name: 'SERVICE_URL', value: process.env.SERVICE_URL || '' },
              { name: 'DOMAIN_NAME', value: DOMAIN_NAME },
              // KasmVNC feature toggles - enable only file transfer (no audio/microphone)
              // { name: 'KASM_SVC_SEND_CUT_TEXT', value: 'true' },
              // { name: 'KASM_SVC_DOWNLOADS', value: 'true' },
              // { name: 'KASM_SVC_UPLOADS', value: 'true' },
              // // Explicitly disable audio features to prevent 404 errors
              // { name: 'KASM_SVC_AUDIO_OUT', value: 'false' },
              // { name: 'KASM_SVC_AUDIO_INPUT', value: 'false' },
              // Add any other needed env vars here
            ],
            ports: [
              { containerPort: 3000, name: 'kasmvnc' },
              { containerPort: 6901, name: 'vnc' },
              { containerPort: 4901, name: 'files' }
            ],
            resources: {
              requests: { memory: '1Gi', cpu: '500m' },
              limits: { memory: '2Gi', cpu: '1' }
            }
          },
          {
            name: 'nginx-proxy',
            image: 'nginx:1.25-alpine',
            ports: [
              { containerPort: 8080, name: 'http' }
            ],
            volumeMounts: [
              {
                name: 'nginx-config',
                mountPath: '/etc/nginx/nginx.conf',
                subPath: 'nginx.conf'
              }
            ],
            resources: {
              requests: { memory: '64Mi', cpu: '100m' },
              limits: { memory: '128Mi', cpu: '200m' }
            }
          }
        ],
          volumes: [
            {
              name: 'nginx-config',
              configMap: { name: 'viper-proxy-config' }
            }
          ],
        restartPolicy: 'Never'
      }
    };

    // Kubernetes Service spec for this specific instance
    const serviceSpec = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: serviceName,
        labels: {
          app: 'viper-instance',
          instanceUUID,
          ownerId: String(ownerId)
        }
      },
      spec: {
        selector: {
          instanceUUID: instanceUUID  // Match pods with this UUID
        },
        ports: [
          {
            protocol: 'TCP',
            port: 3000,
            targetPort: 8080  // Route to nginx sidecar, not directly to KasmVNC
          }
        ],
        type: 'ClusterIP'
      }
    };

    try {
      // Create the pod first
      const pod = await containerService.createContainer(podSpec);

      appLogger.info('Kubernetes pod created for ViPER instance', {
        eventType: 'Pod Created',
        instanceUUID,
        podName,
        podStatus: pod.status?.phase,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        instanceURL,
        timestamp: new Date().toISOString()
      });

      // Create the service
      try {
        await this.createService(serviceSpec);
        appLogger.info('Kubernetes service created for ViPER instance', {
          eventType: 'Service Created',
          instanceUUID,
          serviceName,
          userId: user.id,
          timestamp: new Date().toISOString()
        });
      } catch (svcError) {
        appLogger.warn('Failed to create service, but pod exists', {
          eventType: 'Service Creation Warning',
          instanceUUID,
          serviceName,
          error: (svcError as Error).message,
          timestamp: new Date().toISOString()
        });
      }

      // Create the Ingress for routing
      try {
        // Create nginx ingress for WebSocket support (no BackendConfig needed)
        await this.createIngress(instanceUUID, serviceName);
        appLogger.info('Kubernetes Ingress created for ViPER instance', {
          eventType: 'Ingress Created',
          instanceUUID,
          serviceName,
          userId: user.id,
          timestamp: new Date().toISOString()
        });
      } catch (ingressError) {
        appLogger.warn('Failed to create Ingress, but pod and service exist', {
          eventType: 'Ingress Creation Warning',
          instanceUUID,
          serviceName,
          error: (ingressError as Error).message,
          timestamp: new Date().toISOString()
        });
      }

      // Create database entry immediately after pod creation
      const newViperInstance = await db.ViperInstance.create({
        uuid: instanceUUID,
          podName: podName,
        name: podName,
        url: instanceURL,
        kasmvncPassword: kasmvncPassword,
        statusKey: statusKey,
        owner: ownerId,
        status: 'running',  // Set to running immediately - Kubernetes will manage the pod lifecycle
        logs: [{ timestamp: new Date(), message: 'Pod created' }],
      });

      appLogger.info('ViPER instance database entry created', {
        eventType: 'Database Entry Created',
        instanceId: newViperInstance.id,
        instanceUUID,
        podName,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        pod: {
          name: podName,
          uuid: instanceUUID,
          url: instanceURL,
          status: 'running'  // Match the database status
        },
        message: 'ViPER instance created successfully (Kubernetes)'
      };
    } catch (err) {
      const error = err as Error;
      appLogger.error('Pod creation failed', {
        eventType: 'Pod Creation Failed',
        error: error.message,
        stack: error.stack,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        instanceUUID,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Simulates the ACME certificate process in development mode
   */
  private async simulateDevCertProcess(instanceUUID: string, instance: any): Promise<void> {
    setTimeout(async () => {
      try {
        // Simulate the begin_cert status first
        await db.ViperInstance.update(
          { 
            status: 'begin_cert',
            logs: [...(instance.logs || []), { 
              timestamp: new Date(), 
              message: "Certificate process started (simulated)" 
            }]
          },
          { where: { uuid: instanceUUID } }
        );

        appLogger.info('Dev mode: Certificate process started (simulated)', {
          eventType: 'Dev Status Update',
          instanceUUID,
          status: 'begin_cert',
          timestamp: new Date().toISOString()
        });

        // Wait a bit more then set to active
        setTimeout(async () => {
          try {
            const updatedInstance = await db.ViperInstance.findOne({ where: { uuid: instanceUUID } });
            if (updatedInstance) {
              await updatedInstance.update({
                status: 'active',
                logs: [...(updatedInstance.logs || []), { 
                  timestamp: new Date(), 
                  message: "Instance activated (simulated ACME completion)" 
                }]
              });

              appLogger.info('Dev mode: Instance activated (simulated)', {
                eventType: 'Dev Status Update',
                instanceUUID,
                status: 'active',
                timestamp: new Date().toISOString()
              });
            }
          } catch (activateError) {
            appLogger.warn('Failed to activate instance in dev mode', {
              eventType: 'Dev Status Update Error',
              instanceUUID,
              error: (activateError as Error).message,
              timestamp: new Date().toISOString()
            });
          }
        }, 10000); // Wait 10 seconds then activate
      } catch (certError) {
        appLogger.warn('Failed to start cert process in dev mode', {
          eventType: 'Dev Status Update Error',
          instanceUUID,
          error: (certError as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    }, 5000); // Wait 5 seconds then start cert process
  }

  /**
   * Setup security and monitoring for a container
   */
  private async setupContainerSecurityAndMonitoring(container: any, instanceUUID: string, statusKey: string): Promise<void> {
    // Validate required scripts exist
    const scriptValidation = validateRequiredScripts();
    if (!scriptValidation.valid) {
      throw new Error(`Missing required scripts: ${scriptValidation.missing.join(', ')}`);
    }

    // Remove sudo access (security hardening)
    await this.removeSudoAccess(container, instanceUUID);
    
    // Install monitoring dependencies
    await this.installMonitoringDependencies(container, instanceUUID);
    
    // Setup monitoring scripts and service
    await this.setupMonitoringScripts(container, instanceUUID, statusKey);
    
    // Create desktop shortcut for test corpus
    await this.createTestCorpusShortcut(container, instanceUUID);
  }

  /**
   * Removes sudo access from the container user for security
   */
  private async removeSudoAccess(container: any, instanceUUID: string): Promise<void> {
    try {
      // Remove sudoers file
      await containerService.execInContainer(container.id, ['rm', '-f', '/etc/sudoers.d/abc']);
      
      appLogger.info('Sudoers file removed successfully', {
        eventType: 'Security Hardening',
        instanceUUID,
        containerId: container.id,
        action: 'sudoers_removal',
        timestamp: new Date().toISOString()
      });
      
      // Remove user from sudo group
      await containerService.execInContainer(container.id, ['gpasswd', '-d', 'abc', 'sudo']);
      
      appLogger.info('User removed from sudo group successfully', {
        eventType: 'Security Hardening',
        instanceUUID,
        containerId: container.id,
        action: 'sudo_group_removal',
        timestamp: new Date().toISOString()
      });
    } catch (execErr) { 
      appLogger.warn('Failed to complete sudo access removal', {
        eventType: 'Security Hardening Warning',
        instanceUUID,
        containerId: container.id,
        error: (execErr as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Installs dependencies needed for monitoring
   */
  private async installMonitoringDependencies(container: any, instanceUUID: string): Promise<void> {
    try {
      // Update package lists
      await containerService.execInContainer(container.id, ['apt-get', 'update']);
      
      // Install required packages
      await containerService.execInContainer(container.id, 
        ['apt-get', 'install', '-y', 'scrot', 'xdotool', 'curl', 'bc', 'xinput']
      );
      
      appLogger.info('Monitoring dependencies installed', {
        eventType: 'Monitoring Setup',
        instanceUUID,
        containerId: container.id,
        action: 'dependencies_installed',
        timestamp: new Date().toISOString()
      });
    } catch (execErr) { 
      appLogger.warn('Failed to install monitoring dependencies', {
        eventType: 'Monitoring Setup Warning',
        instanceUUID,
        containerId: container.id,
        error: (execErr as Error).message,
        timestamp: new Date().toISOString()
      });
      throw execErr;
    }
  }

  /**
   * Sets up monitoring scripts and services in the container
   */
  private async setupMonitoringScripts(container: any, instanceUUID: string, statusKey: string): Promise<void> {
    const serviceUrl = process.env.SERVICE_URL || (process.env.NODE_ENV === 'production' ? 
      `http://cloud-viper-gui-app:3000` : `http://localhost:3000`);

    try {
      // Get the monitoring script with variables substituted
      const monitoringScript = readAndProcessScript('viper-monitor.sh', {
        INSTANCE_UUID: instanceUUID,
        SERVICE_URL: serviceUrl,
        DOMAIN_NAME,
        STATUS_KEY: statusKey
      });

      // Create config directory
      await containerService.execInContainer(container.id, ['mkdir', '-p', '/config/.config']);
      
      // Create the monitoring script
      await this.createFileInContainer(container, '/config/.config/viper-monitor.sh', monitoringScript);
      
      // Set executable permissions
      await containerService.execInContainer(container.id, ['chmod', '544', '/config/.config/viper-monitor.sh']);
      
      // Set ownership
      await containerService.execInContainer(container.id, ['chown', 'abc:abc', '/config/.config/viper-monitor.sh']);
      
      appLogger.info('Monitoring script created and made executable', {
        eventType: 'Monitoring Setup',
        instanceUUID,
        containerId: container.id,
        action: 'script_created',
        timestamp: new Date().toISOString()
      });

      // Create systemd service
      const systemdService = readAndProcessScript('viper-monitor.service', {
        INSTANCE_UUID: instanceUUID,
        SERVICE_URL: serviceUrl,
        DOMAIN_NAME,
        STATUS_KEY: statusKey
      });

      // Create systemd directory
      await containerService.execInContainer(container.id, ['mkdir', '-p', '/config/.config/systemd/user']);
      
      // Create service file
      await this.createFileInContainer(container, '/config/.config/systemd/user/viper-monitor.service', systemdService);
      
      // Set ownership
      await containerService.execInContainer(container.id, ['chown', '-R', 'abc:abc', '/config/.config']);
      
      // Set permissions
      await containerService.execInContainer(container.id, ['chmod', '444', '/config/.config/systemd/user/viper-monitor.service']);
      
      appLogger.info('Monitoring systemd service created', {
        eventType: 'Monitoring Setup',
        instanceUUID,
        containerId: container.id,
        action: 'systemd_service_created',
        timestamp: new Date().toISOString()
      });

      // Create autostart entry
      const autostartEntry = readAndProcessScript('viper-monitor.desktop', {
        INSTANCE_UUID: instanceUUID,
        SERVICE_URL: serviceUrl,
        DOMAIN_NAME,
        STATUS_KEY: statusKey
      });

      // Create autostart directory
      await containerService.execInContainer(container.id, ['mkdir', '-p', '/config/.config/autostart']);
      
      // Create desktop entry
      await this.createFileInContainer(container, '/config/.config/autostart/viper-monitor.desktop', autostartEntry);
      
      // Set ownership
      await containerService.execInContainer(container.id, ['chown', '-R', 'abc:abc', '/config/.config']);
      
      // Set permissions
      await containerService.execInContainer(container.id, ['chmod', '444', '/config/.config/autostart/viper-monitor.desktop']);
      
      appLogger.info('XFCE autostart entry created for monitoring', {
        eventType: 'Monitoring Setup',
        instanceUUID,
        containerId: container.id,
        action: 'autostart_created',
        timestamp: new Date().toISOString()
      });

      // Start the monitoring script
      try {
        await containerService.execInContainer(container.id, 
          ['su', 'abc', '-c', 'cd /config/.config && nohup ./viper-monitor.sh > /tmp/viper-monitor.log 2>&1 &']
        );
        
        // Give it time to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if script is running
        const { output } = await containerService.execInContainer(container.id, ['ps', 'aux']);
  const viperProcesses = output.split('\n').filter((line: string) => line.includes('viper-monitor'));
        
        if (viperProcesses.length > 0) {
          appLogger.info('Monitoring script started successfully', {
            eventType: 'Monitoring Running',
            instanceUUID,
            containerId: container.id,
            timestamp: new Date().toISOString()
          });
        } else {
          appLogger.warn('Monitoring script may not be running', {
            eventType: 'Monitoring Warning',
            instanceUUID,
            containerId: container.id,
            timestamp: new Date().toISOString()
          });
        }
      } catch (startError) {
        appLogger.warn('Failed to start monitoring script directly', {
          eventType: 'Monitoring Start Error',
          instanceUUID,
          containerId: container.id,
          error: (startError as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    } catch (setupError) {
      appLogger.warn('Failed to setup monitoring scripts', {
        eventType: 'Monitoring Setup Error',
        instanceUUID,
        containerId: container.id,
        error: (setupError as Error).message,
        timestamp: new Date().toISOString()
      });
      throw setupError;
    }
  }

  /**
   * Creates a test corpus shortcut on the desktop
   */
  private async createTestCorpusShortcut(container: any, instanceUUID: string): Promise<void> {
    try {
      // Create Desktop directory
      await containerService.execInContainer(container.id, ['mkdir', '-p', '/config/Desktop']);
      
      // Desktop shortcut content
      const desktopShortcut = `[Desktop Entry]
Version=1.0
Type=Link
Name=Test Corpus
Comment=Digital preservation test files
Icon=folder
URL=file:///config/test-corpus
`;

      // Create desktop shortcut file
      await this.createFileInContainer(container, '/config/Desktop/test-corpus.desktop', desktopShortcut);
      
      // Set ownership
      await containerService.execInContainer(container.id, ['chown', '-R', 'abc:abc', '/config/Desktop']);
      
      appLogger.info('Test corpus desktop shortcut created', {
        eventType: 'Container Setup',
        instanceUUID,
        containerId: container.id,
        action: 'desktop_shortcut_created',
        timestamp: new Date().toISOString()
      });
    } catch (shortcutErr) {
      appLogger.warn('Failed to create desktop shortcut', {
        eventType: 'Container Setup Warning',
        instanceUUID,
        containerId: container.id,
        error: (shortcutErr as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Helper to create a file with content in a container
   */
  private async createFileInContainer(container: any, filePath: string, content: string): Promise<void> {
    const exec = await container.exec({
      AttachStdout: true, 
      AttachStderr: true,
      Cmd: ['bash', '-c', `cat > ${filePath}`],
      AttachStdin: true
    });
    
    const stream = await exec.start({ hijack: true, stdin: true });
    stream.write(content);
    stream.end();
    
    return new Promise((resolve) => {
      stream.on('end', resolve);
    });
  }

  /**
   * Gets information about a Viper instance
   */
  async inspectInstance(podName: string): Promise<any> {
    try {
      // Find the instance in the database
        const instance = await db.ViperInstance.findOne({ where: { podName: podName } });
      if (!instance) {
        throw new Error('Instance not found');
      }

      // Get pod info from Kubernetes
      const podInspect = await containerService.inspectContainer(podName);

      // Calculate operational hours
      const createdAt = instance.createdAt ? new Date(instance.createdAt) : new Date();
      const now = new Date();
      const operationalHours = ((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)).toFixed(2);

      return {
        instance,
        operationalHours,
        podInspect
      };
    } catch (error) {
      appLogger.error('Error inspecting pod', {
        eventType: 'Pod Inspect Error',
        podName,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Terminates a Viper instance
   */
  async terminateInstance(podName: string, user: ServiceUser): Promise<any> {
    try {
      // Get instance from database
        const instance = await db.ViperInstance.findOne({ where: { podName: podName } });
      
      if (!instance) {
        throw new Error('Instance not found');
      }

      // Check if user has permission to terminate the instance
      if (user.role !== UserRole.ADMIN && user.id !== instance.owner) {
        throw new Error('Unauthorized - can only terminate own instances');
      }

      appLogger.info('Starting instance termination (Kubernetes)', {
        eventType: 'Instance Termination Started',
        userId: user.id,
        userRole: user.role,
        instanceId: instance.id,
        podName,
        timestamp: new Date().toISOString()
      });

      // Set instance status to deleting
      await instance.update({
        status: 'deleted',
        logs: [...(instance.logs || []), { 
          timestamp: new Date(), 
          message: 'User requested termination' 
        }]
      });

      // Extract UUID from podName (format: viper-instance-{uuid})
      const uuid = podName.replace('viper-instance-', '');
      const serviceName = `viper-svc-${uuid}`;
      const ingressName = `viper-ingress-${uuid}`;

      try {
        // Delete the Ingress first
        await this.deleteIngress(ingressName);
        appLogger.info('Ingress deleted for ViPER instance', {
          eventType: 'Ingress Deleted',
          userId: user.id,
          userRole: user.role,
          instanceId: instance.id,
          ingressName,
          timestamp: new Date().toISOString()
        });
      } catch (ingressError) {
        // Log but don't fail if ingress already removed
        appLogger.warn('Error deleting ingress - may already be removed', {
          eventType: 'Ingress Delete Warning',
          error: (ingressError as Error).message,
          instanceId: instance.id,
          ingressName,
          timestamp: new Date().toISOString()
        });
      }

      try {
        // Delete the service
        await this.deleteService(serviceName);
        appLogger.info('Service deleted for ViPER instance', {
          eventType: 'Service Deleted',
          userId: user.id,
          userRole: user.role,
          instanceId: instance.id,
          serviceName,
          timestamp: new Date().toISOString()
        });
      } catch (serviceError) {
        // Log but don't fail if service already removed
        appLogger.warn('Error deleting service - may already be removed', {
          eventType: 'Service Delete Warning',
          error: (serviceError as Error).message,
          instanceId: instance.id,
          serviceName,
          timestamp: new Date().toISOString()
        });
      }

      try {
        // Delete the BackendConfig
        await this.deleteBackendConfig(serviceName);
        appLogger.info('BackendConfig deleted for ViPER instance', {
          eventType: 'BackendConfig Deleted',
          userId: user.id,
          userRole: user.role,
          instanceId: instance.id,
          serviceName,
          timestamp: new Date().toISOString()
        });
      } catch (backendConfigError) {
        // Log but don't fail if BackendConfig already removed
        appLogger.warn('Error deleting BackendConfig - may already be removed', {
          eventType: 'BackendConfig Delete Warning',
          error: (backendConfigError as Error).message,
          instanceId: instance.id,
          serviceName,
          timestamp: new Date().toISOString()
        });
      }

      try {
        // Delete the pod last
        await containerService.removeContainer(podName);
        appLogger.info('Pod deleted for ViPER instance', {
          eventType: 'Pod Deleted',
          userId: user.id,
          userRole: user.role,
          instanceId: instance.id,
          podName,
          timestamp: new Date().toISOString()
        });
      } catch (podError) {
        // Log but don't fail if pod already removed
        appLogger.warn('Error deleting pod - may already be removed', {
          eventType: 'Pod Delete Warning',
          error: (podError as Error).message,
          instanceId: instance.id,
          podName,
          timestamp: new Date().toISOString()
        });
      }

      return { success: true, message: 'Instance terminated successfully (Kubernetes)' };
    } catch (error) {
      appLogger.error('Error terminating instance', {
        eventType: 'Instance Termination Error',
        error: (error as Error).message,
        podName,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
}

// Export a singleton instance
const viperInstanceService = new ViperInstanceService();
export default viperInstanceService;