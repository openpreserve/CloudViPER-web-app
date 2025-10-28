/**
 * Service URL Detection
 * 
 * Automatically detects the public URL for this application in different environments:
 * - Google Cloud Marketplace (LoadBalancer external IP or Ingress hostname)
 * - Development (localhost)
 * - Custom domain (from environment variable)
 */

import * as k8s from '@kubernetes/client-node';
import { appLogger } from '../config/logger';

export interface ServiceUrlInfo {
    url: string;
    source: 'ingress' | 'loadbalancer' | 'nodeport' | 'env' | 'localhost';
    hostname: string;
    protocol: 'http' | 'https';
}

/**
 * Detect the public URL for this application
 * 
 * Priority:
 * 1. Environment variable (DOMAIN_NAME or APP_PUBLIC_URL)
 * 2. Kubernetes Ingress hostname
 * 3. Kubernetes LoadBalancer external IP
 * 4. NodePort (development)
 * 5. Localhost fallback
 */
export async function detectServiceUrl(): Promise<ServiceUrlInfo> {
    // Priority 1: Explicit configuration via environment variable
    if (process.env.APP_PUBLIC_URL) {
        const url = new URL(process.env.APP_PUBLIC_URL);
        return {
            url: process.env.APP_PUBLIC_URL,
            source: 'env',
            hostname: url.hostname,
            protocol: url.protocol.replace(':', '') as 'http' | 'https'
        };
    }

    if (process.env.DOMAIN_NAME) {
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
        return {
            url: `${protocol}://${process.env.DOMAIN_NAME}`,
            source: 'env',
            hostname: process.env.DOMAIN_NAME,
            protocol: protocol as 'http' | 'https'
        };
    }

    // Priority 2-3: Kubernetes auto-detection (for GCP Marketplace)
    try {
        const urlInfo = await detectKubernetesServiceUrl();
        if (urlInfo) {
            return urlInfo;
        }
    } catch (error) {
        appLogger.warn('Failed to detect Kubernetes service URL', {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        });
    }

    // Priority 4: Development fallback
    const port = process.env.PORT || '3000';
    return {
        url: `http://localhost:${port}`,
        source: 'localhost',
        hostname: 'localhost',
        protocol: 'http'
    };
}

/**
 * Detect service URL from Kubernetes resources
 */
async function detectKubernetesServiceUrl(): Promise<ServiceUrlInfo | null> {
    // Check if we're running in Kubernetes
    if (!process.env.KUBERNETES_SERVICE_HOST) {
        return null;
    }

    const kc = new k8s.KubeConfig();
    kc.loadFromCluster(); // Use in-cluster config

    const namespace = process.env.POD_NAMESPACE || 'default';
    const serviceName = process.env.SERVICE_NAME || 'viper-app';

    // Try to get Ingress first (best option - has hostname + HTTPS)
    try {
        const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
        const ingresses = await networkingApi.listNamespacedIngress({ namespace });
        
        // Find ingress for our service
        for (const ingress of ingresses.items) {
            if (ingress.spec?.rules && ingress.spec.rules.length > 0) {
                const rule = ingress.spec.rules[0];
                if (rule.host) {
                    // Check if this ingress routes to our service
                    const routesToOurService = rule.http?.paths?.some((path: any) => 
                        path.backend.service?.name === serviceName
                    );

                    if (routesToOurService || ingress.metadata?.name?.includes(serviceName)) {
                        const protocol = ingress.spec.tls && ingress.spec.tls.length > 0 ? 'https' : 'http';
                        const url = `${protocol}://${rule.host}`;
                        
                        appLogger.info('Detected Ingress URL', {
                            url,
                            ingressName: ingress.metadata?.name,
                            timestamp: new Date().toISOString()
                        });

                        return {
                            url,
                            source: 'ingress',
                            hostname: rule.host,
                            protocol
                        };
                    }
                }
            }
        }
    } catch (error) {
        appLogger.debug('No Ingress found, trying LoadBalancer', {
            error: error instanceof Error ? error.message : String(error)
        });
    }

    // Try LoadBalancer service
    try {
        const coreApi = kc.makeApiClient(k8s.CoreV1Api);
        const service = await coreApi.readNamespacedService({ name: serviceName, namespace });

        if (service.spec?.type === 'LoadBalancer') {
            const ingress = service.status?.loadBalancer?.ingress;
            if (ingress && ingress.length > 0) {
                // GCP LoadBalancer provides an IP
                const externalIP = ingress[0].ip || ingress[0].hostname;
                if (externalIP) {
                    const protocol = 'http'; // LoadBalancer typically uses HTTP unless configured otherwise
                    const url = `${protocol}://${externalIP}`;

                    appLogger.info('Detected LoadBalancer URL', {
                        url,
                        externalIP,
                        timestamp: new Date().toISOString()
                    });

                    return {
                        url,
                        source: 'loadbalancer',
                        hostname: externalIP,
                        protocol
                    };
                }
            }
        }

        // Fallback to NodePort (development)
        if (service.spec?.type === 'NodePort') {
            const nodePort = service.spec.ports?.[0]?.nodePort;
            if (nodePort) {
                // In development, use localhost with NodePort
                const url = `http://localhost:${nodePort}`;
                
                appLogger.info('Detected NodePort service', {
                    url,
                    nodePort,
                    timestamp: new Date().toISOString()
                });

                return {
                    url,
                    source: 'nodeport',
                    hostname: 'localhost',
                    protocol: 'http'
                };
            }
        }
    } catch (error) {
        appLogger.debug('Failed to detect LoadBalancer service', {
            error: error instanceof Error ? error.message : String(error)
        });
    }

    return null;
}

/**
 * Get the public URL for constructing absolute URLs in the application
 * (e.g., for OAuth callbacks, email links, etc.)
 */
export async function getPublicUrl(): Promise<string> {
    const info = await detectServiceUrl();
    return info.url;
}

/**
 * Get the full callback URL for OAuth providers
 */
export async function getOAuthCallbackUrl(provider: string): Promise<string> {
    const baseUrl = await getPublicUrl();
    return `${baseUrl}/account/auth/${provider}/callback`;
}
