import Docker from 'dockerode';
import dotenv from 'dotenv';
import { appLogger } from '../config/logger';

// Extend the typings to fix the return type of listContainers
declare module 'dockerode' {
  interface Docker {
    listContainers(options?: any): Promise<Docker.ContainerInfo[]>;
  }
}

dotenv.config();

/**
 * ContainerService Interface - designed to be implementation agnostic
 * This will make future transition to Kubernetes easier
 */
export interface IContainerService {
  // Core operations
  createContainer(options: any): Promise<any>;
  startContainer(containerId: string): Promise<void>;
  stopContainer(containerId: string): Promise<void>;
  removeContainer(containerId: string): Promise<void>;
  
  // Container information
  inspectContainer(containerId: string): Promise<any>;
  listContainers(options?: any): Promise<any[]>;
  
  // Container execution
  execInContainer(containerId: string, command: string[], options?: any): Promise<{
    output: string;
    exitCode: number;
  }>;

  // Utility method to get container
  getContainer(containerId: string): any;

  // Docker ping
  ping(): Promise<void>;
}

import { CoreV1Api, KubeConfig, V1Pod, V1DeleteOptions } from '@kubernetes/client-node';

export class KubernetesContainerService implements IContainerService {
  private k8sApi: CoreV1Api;
  private namespace: string;

  constructor(namespace = 'default') {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    this.k8sApi = kc.makeApiClient(CoreV1Api);
    this.namespace = namespace;
  }

  async createContainer(options: any): Promise<any> {
    // options should be a valid V1Pod spec
    const podSpec: V1Pod = options;
    // Correct usage: pass as object
    return await this.k8sApi.createNamespacedPod({ namespace: this.namespace, body: podSpec });
  }

  async startContainer(containerId: string): Promise<void> {
    // Pods start automatically in Kubernetes
    return;
  }

  async stopContainer(containerId: string): Promise<void> {
    await this.k8sApi.deleteNamespacedPod({ name: containerId, namespace: this.namespace });
  }

  async removeContainer(containerId: string): Promise<void> {
    await this.stopContainer(containerId);
  }

  async inspectContainer(containerId: string): Promise<any> {
    return await this.k8sApi.readNamespacedPod({ name: containerId, namespace: this.namespace });
  }

  async listContainers(options?: any): Promise<any[]> {
    const result = await this.k8sApi.listNamespacedPod({ namespace: this.namespace });
    return result.items;
  }

  async execInContainer(containerId: string, command: string[], options?: any): Promise<{ output: string; exitCode: number }> {
    // Exec is more complex in k8s, would need to use @kubernetes/client-node exec API
    throw new Error('execInContainer not implemented for Kubernetes');
  }

  getContainer(containerId: string): any {
    // Not needed in k8s, use inspectContainer
    return null;
  }

  async ping(): Promise<void> {
    await this.k8sApi.getAPIResources();
  }
}

// export const containerService = new KubernetesContainerService(process.env.K8S_NAMESPACE || 'default');

export const containerService = new KubernetesContainerService(process.env.K8S_NAMESPACE || 'default');