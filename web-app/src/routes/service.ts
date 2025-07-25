import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import Docker from 'dockerode';
import db from '../models';
import helperFunctions from '../utility/helperFunctions';
import { getAvailablePort } from '../utility/portManager';

dotenv.config();

const router = express.Router();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

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
            "ACME_PRE_HOOK=curl https://www.vipercloud.cc/service/set-status-instance/"+statusKey+"/begin_cert",
            "ACME_POST_HOOK=curl https://www.vipercloud.cc/service/set-status-instance/"+statusKey+"/active",
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
    console.log(containerID);
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

export default router;