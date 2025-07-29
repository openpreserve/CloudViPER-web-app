import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';
import db from '../models';
import helperFunctions from '../utility/helperFunctions';
import { getAvailablePort } from '../utility/portManager';
import { appLogger } from '../config/logger';
import { UserRole } from '../types/UserRole';
import { instanceCreationLimiter, generalApiLimiter } from '../middleware/rateLimiter';

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

router.get('/new-instance', instanceCreationLimiter.middleware(), async (req: Request, res: Response): Promise<void> => {
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
        "ACME_PRE_HOOK=curl https://" + DOMAIN_NAME + "/service/set-status-instance/"+statusKey+"/begin_cert",
        "ACME_POST_HOOK=curl https://" + DOMAIN_NAME + "/service/set-status-instance/"+statusKey+"/active",
    ];

    try {
        // Find an available port for development, production uses reverse proxy
        const availablePort = process.env.NODE_ENV === 'dev' ? await getAvailablePort(3001) : 3000;

        const containerOptions: any = {
            Image: 'darrendignam/opf-viper-cloud:v0.0.10',
            name: containerName,
            HostConfig: {
                ShmSize: 1024 * 1024 * 1024,
                Binds: ['/var/viper-docker-project/volumes/test-corpus/test-root/corpora:/config/Desktop/test-corpus:ro'],
                ...(process.env.NODE_ENV === 'dev' && { PortBindings: { '3000/tcp': [{ HostPort: `${availablePort}` }] } })
            },
            ExposedPorts: { '3000/tcp': {}, '3001/tcp': {} },
            NetworkingConfig: {
                EndpointsConfig: {
                    ...(process.env.NODE_ENV === 'prod' && { 'ingress-proxy': {} })
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

router.get('/viperinstances', generalApiLimiter.middleware(), async (req: Request, res: Response): Promise<void> => {
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

router.get('/terminate-instance/:containerId', generalApiLimiter.middleware(), async (req: Request, res: Response): Promise<void> => {
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

export default router;