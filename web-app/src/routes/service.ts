import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import { QueryTypes, Op } from 'sequelize';
import db from '../models';
import helperFunctions from '../utility/helperFunctions';
import { getAvailablePort } from '../utility/portManager';
import { appLogger } from '../config/logger';
import { UserRole } from '../types/UserRole';
import { readAndProcessScript, validateRequiredScripts } from '../utility/scriptManager';

dotenv.config();

const router = express.Router();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const DOMAIN_NAME = process.env.DOMAIN_NAME || 'cloudviper.org';

/*
ROLES:
- user: nothing
- testing: can run one viper
- member: can run one viper  
- subscriber: pays for use
- admin: viper and user management

Note: These roles are now defined as an enum in ../types/UserRole.ts
*/

interface ServiceUser {
    id: number;
    username: string;
    email: string;
    role: UserRole;
}

function userToJson(_user: ServiceUser) {
    return {
        id: _user.id,
        username: _user.username,
        email: _user.email,
        role: _user.role,
    };
}

// Helper function to check user permissions
function checkUserPermission(user: ServiceUser | undefined, requiredRole: UserRole | UserRole[], resourceOwnerId?: number): {
    authorized: boolean;
    reason?: string;
} {
    if (!user) {
        return { authorized: false, reason: 'Authentication required' };
    }

    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // Admin has access to everything
    if (user.role === UserRole.ADMIN) {
        return { authorized: true };
    }

    // Check if user has required role
    if (!requiredRoles.includes(user.role)) {
        return { authorized: false, reason: `Insufficient permissions. Required: ${requiredRoles.join(' or ')}` };
    }

    // Check resource ownership if specified
    if (resourceOwnerId !== undefined && user.id !== resourceOwnerId) {
        return { authorized: false, reason: 'Can only access own resources' };
    }

    return { authorized: true };
}

// Helper function to get instance limits by role
function getInstanceLimit(role: UserRole): number {
    switch (role) {
        case UserRole.TESTING:
        case UserRole.MEMBER:
            return 1;
        case UserRole.SUBSCRIBER:
            return 10; // or unlimited, depending on business rules
        case UserRole.ADMIN:
            return -1; // unlimited
        default:
            return 0;
    }
}

/* GET home page. */
router.get('/', (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    if (user) {
        switch (user.role) {
            case UserRole.ADMIN:
                res.redirect('/service/admin');
                break;
            case UserRole.TESTING:
                res.redirect('/service/testing');
                break;
            case UserRole.MEMBER:
                res.redirect('/service/member');
                break;

            default:
                res.redirect('/account');
        }
    } else {
        res.redirect('/account/login');
    }
});

router.get('/admin', (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    const permissionCheck = checkUserPermission(user, UserRole.ADMIN);
    
    if (!permissionCheck.authorized) {
        appLogger.warn('Unauthorized admin access attempt', {
            eventType: 'Unauthorized Access',
            userId: user?.id || 'unknown',
            userRole: user?.role || 'unknown',
            endpoint: '/service/admin',
            reason: permissionCheck.reason,
            ipAddress: req.ip,
            timestamp: new Date().toISOString()
        });
        res.redirect('/service');
        return;
    }
    
    res.render('service_admin', { user: userToJson(user!) });
});

router.get('/testing', (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    const permissionCheck = checkUserPermission(user, UserRole.TESTING);
    
    if (!permissionCheck.authorized) {
        appLogger.warn('Unauthorized testing access attempt', {
            eventType: 'Unauthorized Access',
            userId: user?.id || 'unknown',
            userRole: user?.role || 'unknown',
            endpoint: '/service/testing',
            reason: permissionCheck.reason,
            ipAddress: req.ip,
            timestamp: new Date().toISOString()
        });
        res.redirect('/service');
        return;
    }
    
    res.render('service_testing', { user: userToJson(user!) });
});

router.get('/member', (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    const permissionCheck = checkUserPermission(user, UserRole.MEMBER);
    
    if (!permissionCheck.authorized) {
        appLogger.warn('Unauthorized member access attempt', {
            eventType: 'Unauthorized Access',
            userId: user?.id || 'unknown',
            userRole: user?.role || 'unknown',
            endpoint: '/service/member',
            reason: permissionCheck.reason,
            ipAddress: req.ip,
            timestamp: new Date().toISOString()
        });
        res.redirect('/service');
        return;
    }
    
    res.render('service_member', { user: userToJson(user!) });
});

router.get('/new-instance', async (req: Request, res: Response): Promise<void> => {
    const user = req.user as ServiceUser | undefined;
    const permissionCheck = checkUserPermission(user, [UserRole.TESTING, UserRole.MEMBER, UserRole.SUBSCRIBER, UserRole.ADMIN]);

    if (!permissionCheck.authorized) {
        appLogger.warn('Unauthorized instance creation attempt', {
            eventType: 'Unauthorized Access',
            userId: user?.id || 'unknown',
            userRole: user?.role || 'unknown',
            endpoint: '/service/new-instance',
            reason: permissionCheck.reason,
            ipAddress: req.ip,
            timestamp: new Date().toISOString()
        });
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
    }

    // Check instance limits based on user role
    const instanceLimit = getInstanceLimit(user!.role);
    if (instanceLimit > 0) { // -1 means unlimited
        try {
            const existingInstances = await db.ViperInstance.count({
                where: { owner: user!.id }
            });
            
            if (existingInstances >= instanceLimit) {
                appLogger.warn('Instance limit exceeded', {
                    eventType: 'Instance Limit Exceeded',
                    userId: user!.id,
                    userRole: user!.role,
                    existingInstances,
                    limit: instanceLimit,
                    timestamp: new Date().toISOString()
                });
                res.status(429).json({ 
                    error: 'Instance limit reached', 
                    message: `Your ${user!.role} account is limited to ${instanceLimit} active instance${instanceLimit > 1 ? 's' : ''}. Please terminate existing instances before creating new ones.`,
                    existingInstances,
                    limit: instanceLimit
                });
                return;
            }
        } catch (dbError) {
            appLogger.error('Error checking instance limits', {
                eventType: 'Database Error',
                userId: user!.id,
                error: (dbError as Error).message,
                timestamp: new Date().toISOString()
            });
            res.status(500).json({ error: 'Database error checking instance limits' });
            return;
        }
    }

    const ownerId = user!.id;
    const instanceUUID = helperFunctions.generateRandomString(12);
    const kasmvncPassword = helperFunctions.generateRandomString(12);
    const statusKey = helperFunctions.generateRandomString(12);
    const instanceURL = `${instanceUUID}.${process.env.APP_HOST}`;
    const containerName = `viper-cloud-${instanceUUID}`;
    
    appLogger.info('Starting instance creation', {
        eventType: 'Instance Creation Started',
        userId: user!.id,
        userEmail: user!.email,
        userRole: user!.role,
        instanceUUID,
        containerName,
        timestamp: new Date().toISOString()
    });

    const envVars = [
        "VIRTUAL_PORT=3000",
        "VIRTUAL_HOST=" + instanceURL,
        "LETSENCRYPT_HOST=" + instanceURL,
        "LETSENCRYPT_EMAIL=sysadmin@openpreservation.org",
        "PASSWORD=" + kasmvncPassword,
        "PUID=1000",
        "PGID=1000",
        "ACME_PRE_HOOK=curl " + (process.env.SERVICE_URL || (process.env.NODE_ENV === 'production' ? 
            `http://cloud-viper-gui-app:3000` : 
            `http://localhost:3000`)) + "/service/set-status-instance/"+statusKey+"/begin_cert",
        "ACME_POST_HOOK=curl " + (process.env.SERVICE_URL || (process.env.NODE_ENV === 'production' ? 
            `http://cloud-viper-gui-app:3000` : 
            `http://localhost:3000`)) + "/service/set-status-instance/"+statusKey+"/active",
    ];
    console.log('Container Environment Variables:', envVars);

    try {
        // Find an available port for development, production uses reverse proxy
        const availablePort = process.env.NODE_ENV === 'dev' ? await getAvailablePort(3010) : 3000;

        const containerOptions: any = {
            Image: 'darrendignam/opf-viper-cloud:v0.0.10',
            name: containerName,
            HostConfig: {
                ShmSize: 1024 * 1024 * 1024,
                Binds: ['/var/viper-docker-project/volumes/test-corpus/test-root/corpora:/config/Desktop/test-corpus:ro'],
                ...(process.env.NODE_ENV === 'dev' && { PortBindings: { 
                    '3000/tcp': [{ HostPort: `${availablePort}` }],
                    '3001/tcp': [] // Empty binding to prevent null value
                } })
            },
            ExposedPorts: { '3000/tcp': {} },
            NetworkingConfig: {
                EndpointsConfig: {
                    'cloud-viper-net': {},
                    ...(process.env.NODE_ENV === 'prod' && { 'ingress-proxy': {} }),
                    ...(process.env.NODE_ENV === 'production' && { 'ingress-proxy': {} })
                }
            },
            Env: envVars,
        };

        const container = await docker.createContainer(containerOptions);
        await container.start();

        appLogger.info('Container created and started successfully', {
            eventType: 'Container Created',
            instanceUUID,
            containerName,
            containerId: container.id,
            userId: user!.id,
            userEmail: user!.email,
            userRole: user!.role,
            instanceURL,
            timestamp: new Date().toISOString()
        });

        // Create database entry immediately after container starts successfully
        const newViperInstance = await db.ViperInstance.create({
            uuid: instanceUUID,
            dockerid: container.id,
            name: containerName,
            url: instanceURL,
            kasmvncPassword: kasmvncPassword,
            statusKey: statusKey,
            owner: ownerId,
            status: 'created',
            logs: [{ timestamp: new Date(), message: "Created" }],
        });

        appLogger.info('ViPER instance database entry created', {
            eventType: 'Database Entry Created',
            instanceId: newViperInstance.id,
            instanceUUID,
            containerId: container.id,
            userId: user!.id,
            userEmail: user!.email,
            userRole: user!.role,
            timestamp: new Date().toISOString()
        });

        // In development mode, simulate ACME hook completion since SSL certs won't be issued
        if (process.env.NODE_ENV === 'dev') {
            setTimeout(async () => {
                try {
                    // Simulate the begin_cert status first
                    await db.ViperInstance.update(
                        { 
                            status: 'begin_cert',
                            logs: [...(newViperInstance.logs || []), { 
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

        // Setup monitoring and security (non-critical - don't fail instance creation if these fail)
        try {
            // Validate required scripts exist
            const scriptValidation = validateRequiredScripts();
            if (!scriptValidation.valid) {
                throw new Error(`Missing required scripts: ${scriptValidation.missing.join(', ')}`);
            }

            // Remove sudo access (security hardening) with better error handling
            try {
                const exec1 = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['rm', '-f', '/etc/sudoers.d/abc']
                });
                const stream1 = await exec1.start({ hijack: true, stdin: true });
                stream1.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => stream1.on('end', resolve));
                
                appLogger.info('Sudoers file removed successfully', {
                    eventType: 'Security Hardening',
                    instanceUUID,
                    containerId: container.id,
                    action: 'sudoers_removal',
                    timestamp: new Date().toISOString()
                });
            } catch (execErr) { 
                appLogger.warn('Failed to remove sudoers file', {
                    eventType: 'Security Hardening Warning',
                    instanceUUID,
                    containerId: container.id,
                    error: (execErr as Error).message,
                    timestamp: new Date().toISOString()
                });
            }

            try {
                const exec2 = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['gpasswd', '-d', 'abc', 'sudo']
                });
                const stream2 = await exec2.start({ hijack: true, stdin: true });
                stream2.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => stream2.on('end', resolve));
                
                appLogger.info('User removed from sudo group successfully', {
                    eventType: 'Security Hardening',
                    instanceUUID,
                    containerId: container.id,
                    action: 'sudo_group_removal',
                    timestamp: new Date().toISOString()
                });
            } catch (execErr) { 
                appLogger.warn('Failed to remove user from sudo group', {
                    eventType: 'Security Hardening Warning',
                    instanceUUID,
                    containerId: container.id,
                    error: (execErr as Error).message,
                    timestamp: new Date().toISOString()
                });
            }

            // Install monitoring dependencies and create monitoring script
            try {
                // Install required packages for monitoring (split into individual commands)
                const execUpdate = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['apt-get', 'update']
                });
                const streamUpdate = await execUpdate.start({ hijack: true, stdin: true });
                streamUpdate.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => streamUpdate.on('end', resolve));

                const execInstall = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['apt-get', 'install', '-y', 'scrot', 'xdotool', 'curl', 'bc', 'xinput']
                });
                const streamInstall = await execInstall.start({ hijack: true, stdin: true });
                streamInstall.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => streamInstall.on('end', resolve)); 
                
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
            }

            // Create the monitoring script inside the container using external script file
            try {
                const monitoringScript = readAndProcessScript('viper-monitor.sh', {
                    INSTANCE_UUID: instanceUUID,
                    SERVICE_URL: process.env.SERVICE_URL || (process.env.NODE_ENV === 'production' ? 
                        `http://cloud-viper-gui-app:3000` : 
                        `http://localhost:3000`),
                    DOMAIN_NAME: DOMAIN_NAME
                });

                // Create hidden config directory and monitoring script file for abc user
                const execMkdirConfig = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['mkdir', '-p', '/config/.config']
                });
                const streamMkdirConfig = await execMkdirConfig.start({ hijack: true, stdin: true });
                streamMkdirConfig.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => streamMkdirConfig.on('end', resolve));

                const execCreateScript = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['bash', '-c', 'cat > /config/.config/viper-monitor.sh'],
                    AttachStdin: true
                });
                const streamCreateScript = await execCreateScript.start({ hijack: true, stdin: true });
                streamCreateScript.write(monitoringScript);
                streamCreateScript.end();
                await new Promise((resolve) => streamCreateScript.on('end', resolve));
                
                // Make the script executable and read-only, set ownership to abc user
                const execChmod = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['chmod', '544', '/config/.config/viper-monitor.sh']
                });
                const streamChmod = await execChmod.start({ hijack: true, stdin: true });
                streamChmod.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => streamChmod.on('end', resolve));

                // Set ownership to abc user
                const execChownScript = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['chown', 'abc:abc', '/config/.config/viper-monitor.sh']
                });
                const streamChownScript = await execChownScript.start({ hijack: true, stdin: true });
                streamChownScript.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => streamChownScript.on('end', resolve));
                
                appLogger.info('Monitoring script created and made executable', {
                    eventType: 'Monitoring Setup',
                    instanceUUID,
                    containerId: container.id,
                    action: 'script_created',
                    timestamp: new Date().toISOString()
                });
            } catch (execErr) { 
                appLogger.warn('Failed to create monitoring script', {
                    eventType: 'Monitoring Setup Warning',
                    instanceUUID,
                    containerId: container.id,
                    error: (execErr as Error).message,
                    timestamp: new Date().toISOString()
                });
            }

            // Create systemd user service to auto-start monitoring (for XFCE environment)
            try {
                const systemdService = readAndProcessScript('viper-monitor.service', {
                    INSTANCE_UUID: instanceUUID,
                   SERVICE_URL: process.env.SERVICE_URL || (process.env.NODE_ENV === 'production' ? 
                        `http://cloud-viper-gui-app:3000` : 
                        `http://localhost:3000`),
                    DOMAIN_NAME: DOMAIN_NAME
                });

                // Create systemd user directory in /config for abc user
                const execMkdir = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['mkdir', '-p', '/config/.config/systemd/user']
                });
                const streamMkdir = await execMkdir.start({ hijack: true, stdin: true });
                streamMkdir.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => streamMkdir.on('end', resolve));

                // Create the systemd service file using bash -c
                const execCreateService = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['bash', '-c', 'cat > /config/.config/systemd/user/viper-monitor.service'],
                    AttachStdin: true
                });
                const streamCreateService = await execCreateService.start({ hijack: true, stdin: true });
                streamCreateService.write(systemdService);
                streamCreateService.end();
                await new Promise((resolve) => streamCreateService.on('end', resolve));

                // Set ownership of the service file to abc user (read-only for security)
                const execChown = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['chown', '-R', 'abc:abc', '/config/.config']
                });
                const streamChown = await execChown.start({ hijack: true, stdin: true });
                streamChown.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => streamChown.on('end', resolve));

                // Make systemd service file read-only
                const execChmodService = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['chmod', '444', '/config/.config/systemd/user/viper-monitor.service']
                });
                const streamChmodService = await execChmodService.start({ hijack: true, stdin: true });
                streamChmodService.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => streamChmodService.on('end', resolve));
                
                appLogger.info('Monitoring systemd service created', {
                    eventType: 'Monitoring Setup',
                    instanceUUID,
                    containerId: container.id,
                    action: 'systemd_service_created',
                    timestamp: new Date().toISOString()
                });
            } catch (execErr) { 
                appLogger.warn('Failed to create monitoring systemd service', {
                    eventType: 'Monitoring Setup Warning',
                    instanceUUID,
                    containerId: container.id,
                    error: (execErr as Error).message,
                    timestamp: new Date().toISOString()
                });
            }

            // Add autostart entry for XFCE (simplified approach)
            try {
                const autostartEntry = readAndProcessScript('viper-monitor.desktop', {
                    INSTANCE_UUID: instanceUUID,
                   SERVICE_URL: process.env.SERVICE_URL || (process.env.NODE_ENV === 'production' ? 
                        `http://cloud-viper-gui-app:3000` : 
                        `http://localhost:3000`),
                    DOMAIN_NAME: DOMAIN_NAME
                });

                // Create autostart directory in /config for abc user
                const execMkdirAutostart = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['mkdir', '-p', '/config/.config/autostart']
                });
                const streamMkdirAutostart = await execMkdirAutostart.start({ hijack: true, stdin: true });
                streamMkdirAutostart.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => streamMkdirAutostart.on('end', resolve));

                // Create the autostart entry using bash -c
                const execCreateAutostart = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['bash', '-c', 'cat > /config/.config/autostart/viper-monitor.desktop'],
                    AttachStdin: true
                });
                const streamCreateAutostart = await execCreateAutostart.start({ hijack: true, stdin: true });
                streamCreateAutostart.write(autostartEntry);
                streamCreateAutostart.end();
                await new Promise((resolve) => streamCreateAutostart.on('end', resolve));

                // Set ownership and permissions for abc user (read-only for security)
                const execChownAutostart = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['chown', '-R', 'abc:abc', '/config/.config']
                });
                const streamChownAutostart = await execChownAutostart.start({ hijack: true, stdin: true });
                streamChownAutostart.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => streamChownAutostart.on('end', resolve));

                const execChmodAutostart = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['chmod', '444', '/config/.config/autostart/viper-monitor.desktop']
                });
                const streamChmodAutostart = await execChmodAutostart.start({ hijack: true, stdin: true });
                streamChmodAutostart.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => streamChmodAutostart.on('end', resolve));
                
                appLogger.info('XFCE autostart entry created for monitoring', {
                    eventType: 'Monitoring Setup',
                    instanceUUID,
                    containerId: container.id,
                    action: 'autostart_created',
                    timestamp: new Date().toISOString()
                });

                // Start the monitoring script directly
                try {
                    const execDirectStart = await container.exec({
                        AttachStdout: true, 
                        AttachStderr: true,
                        Cmd: ['su', 'abc', '-c', 'cd /config/.config && nohup ./viper-monitor.sh > /tmp/viper-monitor.log 2>&1 &']
                    });
                    const streamDirectStart = await execDirectStart.start({ hijack: true, stdin: true });
                    streamDirectStart.on('data', (data: any) => console.log(data.toString()));
                    await new Promise((resolve) => streamDirectStart.on('end', resolve));

                    // Give it a moment to start
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Verify the service is running
                    const execCheckProcess = await container.exec({
                        AttachStdout: true, 
                        AttachStderr: true,
                        Cmd: ['ps', 'aux']
                    });
                    const streamCheckProcess = await execCheckProcess.start({ hijack: true, stdin: true });
                    let processOutput = '';
                    streamCheckProcess.on('data', (data: any) => {
                        processOutput += data.toString();
                    });
                    await new Promise((resolve) => streamCheckProcess.on('end', resolve));

                    const viperProcesses = processOutput.split('\n').filter(line => line.includes('viper-monitor'));
                    if (viperProcesses.length > 0) {
                        appLogger.info('Monitoring script started successfully', {
                            eventType: 'Monitoring Setup',
                            instanceUUID,
                            containerId: container.id,
                            action: 'script_started_successfully',
                            processCount: viperProcesses.length,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        appLogger.warn('Monitoring script may not have started properly', {
                            eventType: 'Monitoring Setup Warning',
                            instanceUUID,
                            containerId: container.id,
                            action: 'script_start_uncertain',
                            timestamp: new Date().toISOString()
                        });
                    }

                } catch (directStartError) {
                    appLogger.warn('Failed to start monitoring script', {
                        eventType: 'Monitoring Setup Warning',
                        instanceUUID,
                        containerId: container.id,
                        error: (directStartError as Error).message,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (execErr) { 
                appLogger.warn('Failed to create XFCE autostart entry', {
                    eventType: 'Monitoring Setup Warning',
                    instanceUUID,
                    containerId: container.id,
                    error: (execErr as Error).message,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (monitoringError) {
            // Log monitoring setup failure but don't fail the instance creation
            appLogger.warn('Monitoring setup failed - instance created but monitoring may not work', {
                eventType: 'Monitoring Setup Failed',
                instanceUUID,
                containerId: container.id,
                error: (monitoringError as Error).message,
                userId: user!.id,
                timestamp: new Date().toISOString()
            });
            
            // Update database status to indicate monitoring issues
            try {
                await db.ViperInstance.update(
                    { 
                        status: 'active_no_monitoring',
                        logs: [...(newViperInstance.logs || []), { 
                            timestamp: new Date(), 
                            message: "Warning: Monitoring setup failed" 
                        }]
                    },
                    { where: { uuid: instanceUUID } }
                );
            } catch (dbUpdateError) {
                appLogger.error('Failed to update instance status after monitoring failure', {
                    instanceUUID,
                    error: (dbUpdateError as Error).message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        appLogger.info('ViPER instance created successfully', {
            eventType: 'Instance Creation Complete',
            instanceId: newViperInstance.id,
            instanceUUID,
            containerId: container.id,
            userId: user!.id,
            userEmail: user!.email,
            userRole: user!.role,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            container: {
                id: container.id,
                uuid: instanceUUID,
                url: instanceURL,
                status: 'created'
            },
            message: 'ViPER instance created successfully'
        });
    } catch (err) {
        const error = err as Error;
        
        appLogger.error('Container creation failed', {
            eventType: 'Container Creation Failed',
            error: error.message,
            stack: error.stack,
            userId: user!.id,
            userEmail: user!.email,
            userRole: user!.role,
            instanceUUID,
            timestamp: new Date().toISOString()
        });
        
        // Log to database as well
        try {
            await db.Log.create({
                eventType: 'Error',
                message: 'Error creating or starting container',
                eventDescription: error.toString(),
                userId: user!.id,
                createdAt: new Date(),
            });
        } catch (logError) {
            console.error('Failed to log error to database:', logError);
        }
        
        res.status(500).json({ 
            error: 'Error creating or starting container',
            message: 'An error occurred while creating your ViPER instance. Please try again or contact support.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.get('/viperinstances', async (req: Request, res: Response): Promise<void> => {
    const user = req.user as ServiceUser | undefined;
    
    if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    try {
        let instances;
        
        if (user.role === UserRole.ADMIN) {
            // Admin can see all instances with optimized query
            instances = await db.ViperInstance.findAll({
                include: [{
                    model: db.User,
                    as: 'ownerUser',
                    attributes: ['id', 'username', 'email', 'firstName', 'lastName']
                }],
                order: [['createdAt', 'DESC']] // Most recent first
            });
            
            appLogger.info('Admin accessed all instances', {
                eventType: 'Instance List Access',
                userId: user.id,
                userRole: user.role,
                instanceCount: instances.length,
                timestamp: new Date().toISOString()
            });
        } else {
            // Non-admin users can only see their own instances
            const permissionCheck = checkUserPermission(user, [UserRole.TESTING, UserRole.MEMBER, UserRole.SUBSCRIBER]);
            
            if (!permissionCheck.authorized) {
                appLogger.warn('Unauthorized instance list access', {
                    eventType: 'Unauthorized Access',
                    userId: user.id,
                    userRole: user.role,
                    reason: permissionCheck.reason,
                    timestamp: new Date().toISOString()
                });
                res.status(403).json({ error: permissionCheck.reason });
                return;
            }

            instances = await db.ViperInstance.findAll({
                where: { owner: user.id },
                include: [{
                    model: db.User,
                    as: 'ownerUser',
                    attributes: ['id', 'username', 'email', 'firstName', 'lastName']
                }],
                order: [['createdAt', 'DESC']]
            });
            
            appLogger.info('User accessed own instances', {
                eventType: 'Instance List Access',
                userId: user.id,
                userRole: user.role,
                instanceCount: instances.length,
                timestamp: new Date().toISOString()
            });
        }

        // Add additional metadata to instances
        const enrichedInstances = instances.map(instance => ({
            ...instance.toJSON(),
            operationalHours: instance.createdAt ? 
                ((new Date().getTime() - new Date(instance.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(2) : 
                'Unknown',
            canTerminate: user.role === UserRole.ADMIN || instance.owner === user.id
        }));

        res.json({
            instances: enrichedInstances,
            total: enrichedInstances.length,
            userRole: user.role,
            canCreateNew: getInstanceLimit(user.role) === -1 || // Unlimited
                await db.ViperInstance.count({ where: { owner: user.id } }) < getInstanceLimit(user.role)
        });

    } catch (error) {
        const err = error as Error;
        
        appLogger.error('Error retrieving viper instances', {
            eventType: 'Instance List Error',
            userId: user.id,
            userRole: user.role,
            error: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({ 
            error: 'Error retrieving viper instances',
            message: 'Failed to load instance list. Please try again.'
        });
    }
});

router.get('/terminate-instance/:containerId', async (req: Request, res: Response): Promise<void> => {
    const containerID = req.params.containerId;
    const user = req.user as ServiceUser | undefined;
    
    if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    // Input validation
    if (!containerID || typeof containerID !== 'string' || containerID.length < 10) {
        appLogger.warn('Invalid container ID provided', {
            eventType: 'Invalid Container ID',
            containerId: containerID,
            userId: user.id,
            timestamp: new Date().toISOString()
        });
        res.status(400).json({ error: 'Invalid container ID provided' });
        return;
    }

    appLogger.info('Container termination requested', {
        eventType: 'Container Termination Request',
        containerId: containerID,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        timestamp: new Date().toISOString()
    });

    try {
        // Check if user owns this instance or is admin
        const instance = await db.ViperInstance.findOne({
            where: { dockerid: containerID }
        });

        if (!instance) {
            appLogger.warn('Attempt to terminate non-existent instance', {
                eventType: 'Instance Not Found',
                containerId: containerID,
                userId: user.id,
                timestamp: new Date().toISOString()
            });
            res.status(404).json({ error: 'Instance not found' });
            return;
        }

        // Authorization check - only owner or admin can terminate
        if (instance.owner !== user.id && user.role !== UserRole.ADMIN) {
            appLogger.warn('Unauthorized termination attempt', {
                eventType: 'Unauthorized Termination',
                containerId: containerID,
                instanceOwner: instance.owner,
                userId: user.id,
                userRole: user.role,
                timestamp: new Date().toISOString()
            });
            res.status(403).json({ error: 'Unauthorized - you can only terminate your own instances' });
            return;
        }

        const container = docker.getContainer(containerID);
        const response: { [key: string]: any } = {};

        try {
            // Stop the container
            await new Promise<void>((resolve, reject) => {
                container.stop((err: Error | null, data: any) => {
                    if (err) {
                        response["STOP-ERROR"] = { error: err.message };
                        appLogger.warn('Error stopping container', {
                            eventType: 'Container Stop Error',
                            containerId: containerID,
                            error: err.message,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        response["STOP"] = { message: 'Container stopped successfully' };
                        appLogger.info('Container stopped successfully', {
                            eventType: 'Container Stopped',
                            containerId: containerID,
                            timestamp: new Date().toISOString()
                        });
                    }
                    resolve();
                });
            });

            // Remove the container
            await new Promise<void>((resolve, reject) => {
                container.remove((err: Error | null, data: any) => {
                    if (err) {
                        response["REMOVE-ERROR"] = { error: err.message };
                        appLogger.error('Error removing container', {
                            eventType: 'Container Remove Error',
                            containerId: containerID,
                            error: err.message,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        response["REMOVE"] = { message: 'Container removed successfully' };
                        appLogger.info('Container removed successfully', {
                            eventType: 'Container Removed',
                            containerId: containerID,
                            timestamp: new Date().toISOString()
                        });
                    }
                    resolve();
                });
            });

            // Remove from database
            await db.ViperInstance.destroy({
                where: { dockerid: containerID }
            });

            response["DATABASE"] = { message: 'Database entry removed successfully' };
            
            appLogger.info('Instance terminated successfully', {
                eventType: 'Instance Termination Complete',
                containerId: containerID,
                instanceId: instance.id,
                userId: user.id,
                userEmail: user.email,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Instance terminated successfully',
                details: response
            });

        } catch (dockerError) {
            const error = dockerError as Error;
            response["DOCKER-ERROR"] = { error: error.message };
            
            appLogger.error('Docker operation failed during termination', {
                eventType: 'Docker Operation Error',
                containerId: containerID,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });

            // Still try to clean up database even if Docker operations failed
            try {
                await db.ViperInstance.destroy({
                    where: { dockerid: containerID }
                });
                response["DATABASE"] = { message: 'Database entry removed (container may still exist)' };
            } catch (dbError) {
                response["DATABASE-ERROR"] = { error: (dbError as Error).message };
            }

            res.status(500).json({
                success: false,
                message: 'Partial termination - some operations failed',
                details: response
            });
        }

    } catch (dbError) {
        const error = dbError as Error;
        appLogger.error('Database error during termination', {
            eventType: 'Database Error',
            containerId: containerID,
            error: error.message,
            userId: user.id,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            error: 'Database error during termination',
            message: 'Failed to process termination request'
        });
    }
});

router.get('/set-status-instance/:statuskey/:status', async (req: Request, res: Response): Promise<void> => {
    const statuskey = req.params.statuskey;
    const status = req.params.status;

    // Input validation
    if (!statuskey || typeof statuskey !== 'string' || statuskey.length < 8) {
        appLogger.warn('Invalid status key provided', {
            eventType: 'Invalid Status Key',
            statuskey,
            ipAddress: req.ip,
            timestamp: new Date().toISOString()
        });
        res.status(400).json({ error: 'Invalid status key' });
        return;
    }

    // Validate status values
    const validStatuses = ['created', 'starting', 'begin_cert', 'active', 'stopping', 'stopped', 'error'];
    if (!status || !validStatuses.includes(status)) {
        appLogger.warn('Invalid status value provided', {
            eventType: 'Invalid Status Value',
            statuskey,
            status,
            validStatuses,
            ipAddress: req.ip,
            timestamp: new Date().toISOString()
        });
        res.status(400).json({ 
            error: 'Invalid status value',
            validStatuses 
        });
        return;
    }

    appLogger.info('Instance status update requested', {
        eventType: 'Status Update Request',
        statuskey,
        status,
        ipAddress: req.ip,
        timestamp: new Date().toISOString()
    });

    try {
        const instance = await db.ViperInstance.findOne({
            where: { statusKey: statuskey }
        });

        if (!instance) {
            appLogger.warn('Instance not found for status update', {
                eventType: 'Instance Not Found',
                statuskey,
                status,
                timestamp: new Date().toISOString()
            });
            res.status(404).json({ error: 'Instance not found' });
            return;
        }

        // Add new log entry with timestamp
        const newLogEntry = { 
            timestamp: new Date(), 
            message: `Status changed to: ${status}`,
            previousStatus: instance.status
        };

        const updatedLogs = [...(instance.logs || []), newLogEntry];

        await instance.update({
            status: status,
            logs: updatedLogs,
            updatedAt: new Date()
        });

        appLogger.info('Instance status updated successfully', {
            eventType: 'Status Update Complete',
            instanceId: instance.id,
            instanceUUID: instance.uuid,
            statuskey,
            previousStatus: instance.status,
            newStatus: status,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Status updated successfully',
            instance: {
                id: instance.id,
                uuid: instance.uuid,
                previousStatus: instance.status,
                newStatus: status,
                updatedAt: new Date()
            }
        });

    } catch (error) {
        const err = error as Error;
        
        appLogger.error('Error updating instance status', {
            eventType: 'Status Update Error',
            statuskey,
            status,
            error: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            error: 'Database error',
            message: 'Failed to update instance status'
        });
    }
});

// Get detailed Docker inspect data for an instance (admin only)
router.get('/viperinstance/:dockerid/inspect', async (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    
    if (!user || user.role !== UserRole.ADMIN) {
        res.status(403).send({ message: 'Admin access required' });
        return;
    }

    try {
        const { dockerid } = req.params;
        const instance = await db.ViperInstance.findOne({
            where: { dockerid },
            include: [{
                model: db.User,
                as: 'ownerUser',
                attributes: ['id', 'username', 'email', 'firstName', 'lastName']
            }]
        });

        if (!instance) {
            res.status(404).send({ message: 'Instance not found' });
            return;
        }

        // Use the already imported and configured docker instance
        try {
            const container = docker.getContainer(dockerid);
            const inspectData = await container.inspect();
            
            // Calculate operational hours - fix the date creation logic
            const createdDate = instance.createdAt ? new Date(instance.createdAt) : new Date();
            const now = new Date();
            const operationalHours = ((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60)).toFixed(2);
            
            res.json({
                instance: instance,
                operationalHours: operationalHours,
                dockerInspect: inspectData
            });
        } catch (dockerError: any) {
            console.error('Docker inspect error:', dockerError);
            // If Docker inspect fails, still return instance data
            const createdDate = instance.createdAt ? new Date(instance.createdAt) : new Date();
            const now = new Date();
            const operationalHours = ((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60)).toFixed(2);
            
            res.json({
                instance: instance,
                operationalHours: operationalHours,
                dockerInspect: { error: 'Unable to retrieve Docker inspect data', message: dockerError?.message || 'Unknown error' }
            });
        }
    } catch (error) {
        console.error('Error retrieving instance details:', error);
        res.status(500).send({ message: 'Error retrieving instance details', error });
    }
});

// Helper function to read and parse log files
const readLogFile = (logType: string, date?: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const logsDir = path.join(__dirname, '../../logs');
        const logDate = date || new Date().toISOString().split('T')[0];
        const fileName = `${logType}-${logDate}.log`;
        const filePath = path.join(logsDir, fileName);

        if (!fs.existsSync(filePath)) {
            resolve([]);
            return;
        }

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            try {
                const lines = data.trim().split('\n').filter(line => line.length > 0);
                
                if (logType === 'session' || logType === 'app') {
                    // Parse JSON logs
                    const parsedLogs = lines.map((line, index) => {
                        try {
                            return JSON.parse(line);
                        } catch (parseErr) {
                            return {
                                error: 'Failed to parse log entry',
                                rawLine: line,
                                lineNumber: index + 1
                            };
                        }
                    });
                    resolve(parsedLogs);
                } else {
                    // Plain text logs (SQL)
                    const parsedLogs = lines.map((line, index) => ({
                        lineNumber: index + 1,
                        content: line,
                        timestamp: line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) ? 
                                  line.split(' - ')[0] : null
                    }));
                    resolve(parsedLogs);
                }
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
};

// Get session logs (admin only)
router.get('/logs/session', async (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    
    if (!user || user.role !== UserRole.ADMIN) {
        res.status(403).send({ message: 'Admin access required' });
        return;
    }

    try {
        const { date, limit = '50', offset = '0' } = req.query;
        const logs = await readLogFile('session', date as string);
        
        // Apply pagination
        const startIndex = parseInt(offset as string);
        const endIndex = startIndex + parseInt(limit as string);
        const paginatedLogs = logs.slice(startIndex, endIndex);
        
        res.json({
            logs: paginatedLogs,
            total: logs.length,
            hasMore: endIndex < logs.length,
            date: date || new Date().toISOString().split('T')[0]
        });
    } catch (error) {
        console.error('Error reading session logs:', error);
        res.status(500).send({ message: 'Error reading session logs', error });
    }
});

// Get SQL logs (admin only)
router.get('/logs/sql', async (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    
    if (!user || user.role !== UserRole.ADMIN) {
        res.status(403).send({ message: 'Admin access required' });
        return;
    }

    try {
        const { date, limit = '50', offset = '0' } = req.query;
        const logs = await readLogFile('sql', date as string);
        
        // Apply pagination
        const startIndex = parseInt(offset as string);
        const endIndex = startIndex + parseInt(limit as string);
        const paginatedLogs = logs.slice(startIndex, endIndex);
        
        res.json({
            logs: paginatedLogs,
            total: logs.length,
            hasMore: endIndex < logs.length,
            date: date || new Date().toISOString().split('T')[0]
        });
    } catch (error) {
        console.error('Error reading SQL logs:', error);
        res.status(500).send({ message: 'Error reading SQL logs', error });
    }
});

// Get application logs (admin only)
router.get('/logs/app', async (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    
    if (!user || user.role !== UserRole.ADMIN) {
        res.status(403).send({ message: 'Admin access required' });
        return;
    }

    try {
        const { date, limit = '50', offset = '0' } = req.query;
        const logs = await readLogFile('app', date as string);
        
        // Apply pagination
        const startIndex = parseInt(offset as string);
        const endIndex = startIndex + parseInt(limit as string);
        const paginatedLogs = logs.slice(startIndex, endIndex);
        
        res.json({
            logs: paginatedLogs,
            total: logs.length,
            hasMore: endIndex < logs.length,
            date: date || new Date().toISOString().split('T')[0]
        });
    } catch (error) {
        console.error('Error reading application logs:', error);
        res.status(500).send({ message: 'Error reading application logs', error });
    }
});

// Get available log dates (admin only)
router.get('/logs/dates', async (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    
    if (!user || user.role !== UserRole.ADMIN) {
        res.status(403).send({ message: 'Admin access required' });
        return;
    }

    try {
        const logsDir = path.join(__dirname, '../../logs');
        
        // Check if logs directory exists, if not create it
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        const files = fs.readdirSync(logsDir);
        
        const logDates = new Set<string>();
        const logTypes = ['session', 'sql', 'app'];
        
        files.forEach(file => {
            logTypes.forEach(type => {
                const regex = new RegExp(`^${type}-(\\d{4}-\\d{2}-\\d{2})\\.log$`);
                const match = file.match(regex);
                if (match) {
                    logDates.add(match[1]);
                }
            });
        });
        
        const sortedDates = Array.from(logDates).sort().reverse(); // Most recent first
        
        res.json({
            dates: sortedDates,
            types: logTypes
        });
    } catch (error) {
        console.error('Error reading log directory:', error);
        res.status(500).send({ message: 'Error reading log directory', error });
    }
});

// System health check endpoint
router.get('/health', async (req: Request, res: Response): Promise<void> => {
    const user = req.user as ServiceUser | undefined;
    
    // Basic health check available to all authenticated users
    if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    try {
        const healthData: any = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development'
        };

        // Database connectivity check
        try {
            await db.sequelize.authenticate();
            healthData.database = { status: 'connected' };
        } catch (dbError) {
            healthData.database = { status: 'error', message: (dbError as Error).message };
            healthData.status = 'degraded';
        }

        // Docker connectivity check
        try {
            await docker.ping();
            healthData.docker = { status: 'connected' };
        } catch (dockerError) {
            healthData.docker = { status: 'error', message: (dockerError as Error).message };
            healthData.status = 'degraded';
        }

        // Admin users get additional statistics
        if (user.role === UserRole.ADMIN) {
            try {
                const [totalInstances, activeInstances, totalUsers] = await Promise.all([
                    db.ViperInstance.count(),
                    db.ViperInstance.count({ where: { status: 'active' } }),
                    db.User.count()
                ]);

                healthData.statistics = {
                    totalInstances,
                    activeInstances,
                    totalUsers,
                    memoryUsage: process.memoryUsage()
                };
            } catch (statsError) {
                healthData.statistics = { error: 'Failed to gather statistics' };
            }
        }

        const httpStatus = healthData.status === 'healthy' ? 200 : 503;
        res.status(httpStatus).json(healthData);

    } catch (error) {
        appLogger.error('Health check failed', {
            eventType: 'Health Check Error',
            userId: user.id,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});

// Instance usage statistics (admin only)
router.get('/statistics', async (req: Request, res: Response): Promise<void> => {
    const user = req.user as ServiceUser | undefined;
    const permissionCheck = checkUserPermission(user, UserRole.ADMIN);
    
    if (!permissionCheck.authorized) {
        res.status(403).json({ error: permissionCheck.reason });
        return;
    }

    try {
        const [
            totalInstances,
            activeInstances,
            instancesByRole,
            instancesByStatus,
            recentInstances
        ] = await Promise.all([
            db.ViperInstance.count(),
            db.ViperInstance.count({ where: { status: 'active' } }),
            db.sequelize.query(`
                SELECT u.role, COUNT(v.id) as count 
                FROM Users u 
                LEFT JOIN ViperInstances v ON u.id = v.owner 
                GROUP BY u.role
            `, { type: QueryTypes.SELECT }),
            db.sequelize.query(`
                SELECT status, COUNT(*) as count 
                FROM ViperInstances 
                GROUP BY status
            `, { type: QueryTypes.SELECT }),
            db.ViperInstance.findAll({
                limit: 10,
                order: [['createdAt', 'DESC']],
                include: [{
                    model: db.User,
                    as: 'ownerUser',
                    attributes: ['username', 'email', 'role']
                }],
                attributes: ['id', 'uuid', 'status', 'createdAt', 'url']
            })
        ]);

        res.json({
            summary: {
                totalInstances,
                activeInstances,
                inactiveInstances: totalInstances - activeInstances
            },
            byRole: instancesByRole,
            byStatus: instancesByStatus,
            recentInstances: recentInstances.map(instance => ({
                ...instance.toJSON(),
                age: instance.createdAt ? 
                    Math.round((new Date().getTime() - new Date(instance.createdAt).getTime()) / (1000 * 60 * 60)) + ' hours' : 
                    'Unknown'
            })),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        appLogger.error('Error generating statistics', {
            eventType: 'Statistics Error',
            userId: user!.id,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            error: 'Error generating statistics',
            message: 'Failed to gather system statistics'
        });
    }
});

// Screenshot upload endpoint - containers can send screenshots
router.post('/screenshot/:instanceUUID', async (req: Request, res: Response): Promise<void> => {
    const { instanceUUID } = req.params;
    const { screenshot, timestamp } = req.body;

    // Validate instance exists
    try {
        const instance = await db.ViperInstance.findOne({
            where: { uuid: instanceUUID }
        });

        if (!instance) {
            appLogger.warn('Screenshot upload for unknown instance', {
                eventType: 'Unknown Instance Screenshot',
                instanceUUID,
                timestamp: new Date().toISOString()
            });
            res.status(404).json({ error: 'Instance not found' });
            return;
        }

        // Store screenshot data (base64 encoded image)
        const screenshotData = {
            instanceUUID,
            screenshot: screenshot, // base64 encoded image
            capturedAt: timestamp || new Date().toISOString(),
            receivedAt: new Date().toISOString()
        };

        // Debug logging for screenshot data
        console.log('DEBUG: Screenshot data keys:', Object.keys(screenshotData));
        console.log('DEBUG: Screenshot field type:', typeof screenshotData.screenshot);
        console.log('DEBUG: Screenshot field length:', screenshotData.screenshot ? screenshotData.screenshot.length : 'null/undefined');

        // Update instance with latest screenshot and activity
        await instance.update({
            lastScreenshot: screenshotData,
            lastActivity: new Date(),
            updatedAt: new Date()
        });

        appLogger.info('Screenshot received and stored', {
            eventType: 'Screenshot Received',
            instanceUUID,
            instanceId: instance.id,
            screenshotSize: screenshot ? screenshot.length : 0,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Screenshot received',
            instanceUUID
        });

    } catch (error) {
        appLogger.error('Error storing screenshot', {
            eventType: 'Screenshot Storage Error',
            instanceUUID,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            error: 'Error storing screenshot',
            message: 'Failed to process screenshot data'
        });
    }
});

// Activity report endpoint - containers can report user activity
router.post('/activity/:instanceUUID', async (req: Request, res: Response): Promise<void> => {
    const { instanceUUID } = req.params;
    const { 
        mouseEvents: rawMouseEvents = 0, 
        keyboardEvents: rawKeyboardEvents = 0, 
        timestamp,
        windowActive = false,
        cpuUsage: rawCpuUsage = 0,
        memoryUsage: rawMemoryUsage = 0 
    } = req.body;

    // Ensure numeric values
    const mouseEvents = Number(rawMouseEvents) || 0;
    const keyboardEvents = Number(rawKeyboardEvents) || 0;
    const cpuUsage = Number(rawCpuUsage) || 0;
    const memoryUsage = Number(rawMemoryUsage) || 0;

    try {
        const instance = await db.ViperInstance.findOne({
            where: { uuid: instanceUUID }
        });

        if (!instance) {
            appLogger.warn('Activity report for unknown instance', {
                eventType: 'Unknown Instance Activity',
                instanceUUID,
                timestamp: new Date().toISOString()
            });
            res.status(404).json({ error: 'Instance not found' });
            return;
        }

        const activityData = {
            instanceUUID,
            mouseEvents,
            keyboardEvents,
            windowActive,
            cpuUsage,
            memoryUsage,
            timestamp: timestamp || new Date().toISOString(),
            receivedAt: new Date().toISOString()
        };

        // Calculate activity score (mouse + keyboard events)
        const activityScore = mouseEvents + keyboardEvents;
        const isActive = activityScore > 0 || windowActive;

        // Update instance activity
        const currentActivity = instance.activityHistory || [];
        const updatedActivity = [...currentActivity, activityData].slice(-100); // Keep last 100 entries

        await instance.update({
            lastActivity: isActive ? new Date() : instance.lastActivity,
            activityHistory: updatedActivity,
            activityScore: activityScore,
            isUserActive: isActive,
            updatedAt: new Date()
        });

        // Check for inactivity (no activity for 30 minutes)
        const inactivityThreshold = 30 * 60 * 1000; // 30 minutes in milliseconds
        const lastActivityTime = instance.lastActivity ? new Date(instance.lastActivity).getTime() : 0;
        const now = new Date().getTime();
        const inactiveTime = now - lastActivityTime;

        let shouldShutdown = false;
        if (inactiveTime > inactivityThreshold && instance.status === 'active') {
            shouldShutdown = true;
            
            appLogger.warn('Instance inactive - marking for shutdown', {
                eventType: 'Inactivity Detected',
                instanceUUID,
                instanceId: instance.id,
                inactiveMinutes: Math.round(inactiveTime / (1000 * 60)),
                lastActivity: instance.lastActivity,
                timestamp: new Date().toISOString()
            });

            // Update status to indicate pending shutdown
            await instance.update({
                status: 'inactive_pending_shutdown',
                updatedAt: new Date()
            });
        }

        appLogger.info('Activity report received', {
            eventType: 'Activity Report',
            instanceUUID,
            instanceId: instance.id,
            activityScore,
            isActive,
            inactiveMinutes: Math.round(inactiveTime / (1000 * 60)),
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Activity report received',
            instanceUUID,
            activityScore,
            isActive,
            shouldShutdown,
            inactiveMinutes: Math.round(inactiveTime / (1000 * 60))
        });

    } catch (error) {
        appLogger.error('Error processing activity report', {
            eventType: 'Activity Report Error',
            instanceUUID,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            error: 'Error processing activity report',
            message: 'Failed to process activity data'
        });
    }
});

// Test endpoint for monitoring script debugging (no auth required)
router.get('/monitoring-test/:instanceUUID', async (req: Request, res: Response): Promise<void> => {
    const { instanceUUID } = req.params;
    
    try {
        const instance = await db.ViperInstance.findOne({
            where: { uuid: instanceUUID }
        });

        if (!instance) {
            res.status(404).json({ 
                error: 'Instance not found',
                instanceUUID,
                message: 'No instance found with this UUID'
            });
            return;
        }

        res.json({
            success: true,
            instanceUUID,
            message: 'Monitoring test endpoint - instance found',
            instance: {
                id: instance.id,
                uuid: instance.uuid,
                status: instance.status,
                lastActivity: instance.lastActivity,
                isUserActive: instance.isUserActive,
                activityScore: instance.activityScore
            },
            endpoints: {
                screenshot: `/service/screenshot/${instanceUUID}`,
                activity: `/service/activity/${instanceUUID}`,
                test: `/service/monitoring-test/${instanceUUID}`
            },
            testCurl: {
                activity: `curl -X POST '${req.protocol}://${req.get('host')}/service/activity/${instanceUUID}' -H 'Content-Type: application/json' -d '{"mouseEvents":1,"keyboardEvents":1,"windowActive":true,"cpuUsage":10,"memoryUsage":20}'`
            }
        });

    } catch (error) {
        res.status(500).json({
            error: 'Database error',
            message: (error as Error).message,
            instanceUUID
        });
    }
});

// Get latest screenshot for an instance (admin only)
router.get('/screenshot/:instanceUUID', async (req: Request, res: Response): Promise<void> => {
    const user = req.user as ServiceUser | undefined;
    const { instanceUUID } = req.params;

    // Check permissions
    if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    try {
        const instance = await db.ViperInstance.findOne({
            where: { uuid: instanceUUID }
        });

        if (!instance) {
            res.status(404).json({ error: 'Instance not found' });
            return;
        }

        // Check if user owns instance or is admin
        if (instance.owner !== user.id && user.role !== UserRole.ADMIN) {
            res.status(403).json({ error: 'Unauthorized - can only view own instances' });
            return;
        }

        if (!instance.lastScreenshot) {
            res.status(404).json({ error: 'No screenshot available' });
            return;
        }

        res.json({
            success: true,
            screenshot: instance.lastScreenshot,
            instanceUUID
        });

    } catch (error) {
        appLogger.error('Error retrieving screenshot', {
            eventType: 'Screenshot Retrieval Error',
            instanceUUID,
            userId: user.id,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            error: 'Error retrieving screenshot',
            message: 'Failed to get screenshot data'
        });
    }
});

// Get activity history for an instance
router.get('/activity/:instanceUUID', async (req: Request, res: Response): Promise<void> => {
    const user = req.user as ServiceUser | undefined;
    const { instanceUUID } = req.params;
    const { limit = '50' } = req.query;

    if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    try {
        const instance = await db.ViperInstance.findOne({
            where: { uuid: instanceUUID }
        });

        if (!instance) {
            res.status(404).json({ error: 'Instance not found' });
            return;
        }

        // Check permissions
        if (instance.owner !== user.id && user.role !== UserRole.ADMIN) {
            res.status(403).json({ error: 'Unauthorized - can only view own instances' });
            return;
        }

        const activityHistory = instance.activityHistory || [];
        const limitNum = parseInt(limit as string);
        const recentActivity = activityHistory.slice(-limitNum);

        // Calculate activity summary
        const totalEvents = recentActivity.reduce((sum: number, activity: any) => 
            sum + (activity.mouseEvents || 0) + (activity.keyboardEvents || 0), 0);
        
        const avgCpuUsage = recentActivity.length > 0 ? 
            recentActivity.reduce((sum: number, activity: any) => sum + (activity.cpuUsage || 0), 0) / recentActivity.length : 0;
        
        const avgMemoryUsage = recentActivity.length > 0 ? 
            recentActivity.reduce((sum: number, activity: any) => sum + (activity.memoryUsage || 0), 0) / recentActivity.length : 0;

        res.json({
            success: true,
            instanceUUID,
            activityHistory: recentActivity,
            summary: {
                totalEvents,
                avgCpuUsage: Math.round(avgCpuUsage * 100) / 100,
                avgMemoryUsage: Math.round(avgMemoryUsage * 100) / 100,
                lastActivity: instance.lastActivity,
                isUserActive: instance.isUserActive,
                currentScore: instance.activityScore || 0
            }
        });

    } catch (error) {
        appLogger.error('Error retrieving activity history', {
            eventType: 'Activity History Error',
            instanceUUID,
            userId: user.id,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            error: 'Error retrieving activity history',
            message: 'Failed to get activity data'
        });
    }
});

// Auto-shutdown inactive instances (admin endpoint)
router.post('/cleanup-inactive', async (req: Request, res: Response): Promise<void> => {
    const user = req.user as ServiceUser | undefined;
    const permissionCheck = checkUserPermission(user, UserRole.ADMIN);
    
    if (!permissionCheck.authorized) {
        res.status(403).json({ error: permissionCheck.reason });
        return;
    }

    try {
        const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - inactivityThreshold);

        // Find instances that are inactive and marked for shutdown
        const inactiveInstances = await db.ViperInstance.findAll({
            where: {
                status: 'inactive_pending_shutdown',
                lastActivity: {
                    [Op.lt]: cutoffTime
                }
            }
        });

        const shutdownResults = [];

        for (const instance of inactiveInstances) {
            try {
                const container = docker.getContainer(instance.dockerid);
                
                // Stop and remove container
                await container.stop();
                await container.remove();
                
                // Update database
                await instance.update({
                    status: 'auto_shutdown',
                    updatedAt: new Date()
                });

                shutdownResults.push({
                    instanceUUID: instance.uuid,
                    containerId: instance.dockerid,
                    success: true
                });

                appLogger.info('Instance auto-shutdown completed', {
                    eventType: 'Auto Shutdown',
                    instanceUUID: instance.uuid,
                    instanceId: instance.id,
                    containerId: instance.dockerid,
                    reason: 'inactivity',
                    timestamp: new Date().toISOString()
                });

            } catch (shutdownError) {
                shutdownResults.push({
                    instanceUUID: instance.uuid,
                    containerId: instance.dockerid,
                    success: false,
                    error: (shutdownError as Error).message
                });

                appLogger.error('Failed to auto-shutdown instance', {
                    eventType: 'Auto Shutdown Error',
                    instanceUUID: instance.uuid,
                    error: (shutdownError as Error).message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        res.json({
            success: true,
            message: 'Inactive instances cleanup completed',
            shutdownCount: shutdownResults.filter(r => r.success).length,
            results: shutdownResults
        });

    } catch (error) {
        appLogger.error('Error during inactive cleanup', {
            eventType: 'Cleanup Error',
            userId: user!.id,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            error: 'Error during cleanup',
            message: 'Failed to cleanup inactive instances'
        });
    }
});

export default router;