import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import db from '../models';
import helperFunctions from '../utility/helperFunctions';
import { getAvailablePort } from '../utility/portManager';
import { appLogger } from '../config/logger';

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
*/

interface ServiceUser {
    id: number;
    username: string;
    email: string;
    role: string;
}

function userToJson(_user: ServiceUser) {
    return {
        id: _user.id,
        username: _user.username,
        email: _user.email,
        role: _user.role,
    };
}

/* GET home page. */
router.get('/', (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    if (user) {
        switch (user.role) {
            case 'admin':
                res.redirect('/service/admin');
                break;
            case 'testing':
                res.redirect('/service/testing');
                break;
            case 'member':
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
    if (user && user.role === 'admin') {
        res.render('service_admin', { user: userToJson(user) });
    } else {
        res.redirect('/service');
    }
});

router.get('/testing', (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    if (user && user.role === 'testing') {
        res.render('service_testing', { user: userToJson(user) });
    } else {
        res.redirect('/service');
    }
});

router.get('/member', (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    if (user && user.role === 'member') {
        res.render('service_member', { user: userToJson(user) });
    } else {
        res.redirect('/service');
    }
});

router.get('/new-instance', async (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;

    if (user && user.role !== 'user') {
        const ownerId = user.id;

        const instanceUUID = helperFunctions.generateRandomString(12);
        const kasmvncPassword = helperFunctions.generateRandomString(12);
        const statusKey = helperFunctions.generateRandomString(12);
        const instanceURL = `${instanceUUID}.${process.env.APP_HOST}`;
        const containerName = `viper-cloud-${instanceUUID}`;
        console.log(instanceUUID);

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
                instanceUUID,
                containerName,
                containerId: container.id,
                userId: user.id,
                userEmail: user.email,
                instanceURL,
                timestamp: new Date().toISOString()
            });

            // Remove sudo access (security hardening)
            try {
                const exec1 = await container.exec({
                    AttachStdout: true, 
                    AttachStderr: true,
                    Cmd: ['rm', '-f', '/etc/sudoers.d/abc']
                });
                const stream1 = await exec1.start({ hijack: true, stdin: true });
                stream1.on('data', (data: any) => console.log(data.toString()));
                await new Promise((resolve) => stream1.on('end', resolve));
                console.log('Sudoers file deleted successfully');
            } catch (execErr) { 
                console.error('Error executing command:', execErr); 
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
                console.log('User removed from sudo group successfully');
            } catch (execErr) { 
                console.error('Error executing command:', execErr); 
            }

            console.log('Container setup completed');

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

            res.json({
                container: {
                    id: container.id,
                    uuid: instanceUUID,
                    url: instanceURL,
                }
            });
        } catch (err) {
            console.log('Error creating or starting container:', err);
            appLogger.error('Container creation failed', {
                error: (err as Error).message,
                stack: (err as Error).stack,
                userId: user.id,
                userEmail: user.email,
                instanceUUID,
                timestamp: new Date().toISOString()
            });
            
            await db.Log.create({
                eventType: 'Error',
                message: 'Error creating or starting container',
                eventDescription: (err as Error).toString(),
                userId: user.id,
                createdAt: new Date(),
            });
            res.status(500).json({ error: 'Error creating or starting container' });
        }
    } else {
        res.json({ "error": "Authentication" });
    }
});

router.get('/viperinstances', async (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    
    if (user && user.role === 'admin') {
        try {
            const instances = await db.ViperInstance.findAll({
                include: [{
                    model: db.User,
                    as: 'ownerUser',
                    attributes: ['id', 'username', 'email', 'firstName', 'lastName']
                }]
            });
            res.json(instances);
        } catch (error) {
            console.error('Error retrieving viper instances:', error);
            res.status(500).send({ message: 'Error retrieving viper instances', error });
        }
    } else if (user && user.role !== 'user') {
        try {
            const userId = user.id;
            const instances = await db.ViperInstance.findAll({
                where: {
                    owner: userId
                },
                include: [{
                    model: db.User,
                    as: 'ownerUser',
                    attributes: ['id', 'username', 'email', 'firstName', 'lastName']
                }]
            });
            res.json(instances);
        } catch (error) {
            console.error('Error retrieving viper instances:', error);
            res.status(500).send({ message: 'Error retrieving viper instances', error });
        }
    } else {
        res.status(403).send({ message: 'Error 4' });
    }
});

router.get('/terminate-instance/:containerId', async (req: Request, res: Response) => {
    const containerID = req.params.containerId;
    const user = req.user as ServiceUser | undefined;
    
    console.log(containerID);
    appLogger.info('Container termination requested', {
        containerId: containerID,
        userId: user?.id,
        userEmail: user?.email,
        timestamp: new Date().toISOString()
    });
    
    const container = docker.getContainer(containerID);

    let ti_response: { [key: string]: any } = {}

    container.stop((err: Error | null, data: any) => {
        if (err) {
            ti_response["STOP-ERROR"] = { 'Error stopping container': err };
        }
        console.log('Container stopped:', data);

        // Remove the container
        container.remove((err: Error | null, data: any) => {
            if (err) {
                ti_response["REMOVE-ERROR"] = { 'Error removing container': err };
            }
            ti_response["REMOVE"] = { 'Container removed': data };

            // Use destroy() method like the original JS version
            db.ViperInstance.destroy({
                where: {
                    dockerid: containerID
                }
            }).then(() => {
                ti_response["DATABASE"] = { 'Entry Removed': containerID };
                res.json(ti_response);
            }).catch((error: Error) => {
                ti_response["DATABASE"] = { 'Error': error };
                res.json(ti_response);
            });
        });
    });
});

router.get('/set-status-instance/:statuskey/:status', async (req: Request, res: Response) => {
    const _statuskey = req.params.statuskey;
    const _status = req.params.status;

    console.log(`SET-STATUS::::::: ${_statuskey} : ${_status}`);

    let ti_response: { [key: string]: any } = {};

    db.ViperInstance.findOne({
        where: {
            statusKey: _statuskey
        }
    }).then((instance: any | null) => {
        if (!instance) {
            console.error('Instance not found');
            return;
        }

        instance.logs = [...instance.logs, { timestamp: new Date(), message: 'Set Status to: ' + _status }];
        instance.status = _status;

        return instance.save();
    }).then(() => {
        ti_response["DATABASE"] = { 'Entry Updated': _statuskey };
        res.json(ti_response);
    }).catch((error: Error) => {
        ti_response["DATABASE"] = { 'Error': error };
        res.json(ti_response);
    });
});

// Get detailed Docker inspect data for an instance (admin only)
router.get('/viperinstance/:dockerid/inspect', async (req: Request, res: Response) => {
    const user = req.user as ServiceUser | undefined;
    
    if (!user || user.role !== 'admin') {
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
    
    if (!user || user.role !== 'admin') {
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
    
    if (!user || user.role !== 'admin') {
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
    
    if (!user || user.role !== 'admin') {
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
    
    if (!user || user.role !== 'admin') {
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

export default router;