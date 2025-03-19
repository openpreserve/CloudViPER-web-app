import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
// import { Op } from 'sequelize';
import Docker from 'dockerode';
import db from '../models';
import getPort from 'get-port';
import helperFunctions from '../utility/helperFunctions';

dotenv.config();

const router = express.Router();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/*
ROLES:

user - nothing
testing - can run one viper
member - can run one viper
subscriber - pays for use
admin - viper and user management

*/
interface User {
    id: number;
    username: string;
    role: string;
    // Add other properties as needed
}

// interface ViperInstance {
//     id: number;
//     uuid: string;
//     dockerid: string;
//     name: string;
//     url: string;
//     kasmvncPassword: string;
//     statusKey: string;
//     owner: number;
//     status: string;
//     logs: LogEntry[];
//     save: () => Promise<void>;
// }


interface LogEntry {
    timestamp: Date;
    message: string;
}

function userToJson(_user: User){
    return {
        id: _user.id,
        username: _user.username,
        role: _user.role,
    }
}

/* GET home page. */
router.get('/', (req: Request, res: Response) => {
    const user = req.user as User | undefined;
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
    const user = req.user as User | undefined;
    if (user && user.role == 'admin') {
        res.render('service_admin', { user: userToJson(user) });
    } else {
        res.redirect('/service');
    }
});
router.get('/testing', (req: Request, res: Response) => {
    const user = req.user as User | undefined;
    if (user && user.role == 'testing') {
        res.render('service_testing', { user: userToJson(user) });
    } else {
        res.redirect('/service');
    }
});
router.get('/member', (req: Request, res: Response) => {
    const user = req.user as User | undefined;
    if (user && user.role == 'member') {
        res.render('service_member', { user: userToJson(user) });
    } else {
        res.redirect('/service');
    }
});

router.get('/new-instance', async (req: Request, res: Response) => {
    const user = req.user as User | undefined;
    // const availablePort = await getAvailablePort();
    // const portString = `${availablePort}/tcp`;

    if (user && user.role != 'user') {
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

        interface DockerContainerOptions {
            Image: string;
            name: string;
            HostConfig: {
                ShmSize: number;
                Binds: string[];
                PortBindings?: {
                    [port: string]: [{ HostPort: string }];
                };
            };
            ExposedPorts: {
                [port: string]: {};
            };
            NetworkingConfig: {
                EndpointsConfig: {
                    [endpoint: string]: {};
                };
            };
            Env: string[];
        }

        interface DockerContainer {
            id: string;
            start: () => Promise<void>;
            exec: (options: DockerExecOptions) => Promise<DockerExec>;
        }

        interface DockerExecOptions {
            AttachStdout: boolean;
            AttachStderr: boolean;
            Cmd: string[];
        }

        interface DockerExec {
            start: (options: { hijack: boolean; stdin: boolean }) => Promise<DockerExecStream>;
        }

        interface DockerExecStream {
            output: {
                on: (event: string, callback: (data: any) => void) => void;
            };
        }

        try {
            // Find an available port
            const availablePort = await getPort();
            const portString = `${availablePort}/tcp`;

            let _DockerContainerOptions: DockerContainerOptions = {
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
                        'ingress-proxy': {}
                    }
                },
                Env: envVars,
            };

            const container = await docker.createContainer(_DockerContainerOptions);
            await container.start();

            try {
                const exec = await container.exec({
                    AttachStdout: true, AttachStderr: true,
                    Cmd: ['rm', '-f', '/etc/sudoers.d/abc']
                } as DockerExecOptions);
                const stream = await exec.start({
                    hijack: true, stdin: true
                });
                stream.on('data', (data: any) => {
                    console.log(data.toString());
                });
                await new Promise((resolve) => {
                    stream.on('end', resolve);
                });
                console.log('Sudoers file deleted successfully');
            } catch (execErr) { console.error('Error executing command:', execErr); }

            try {
                const exec = await container.exec({
                    AttachStdout: true, AttachStderr: true,
                    Cmd: ['gpasswd', '-d', 'abc', 'sudo']
                } as DockerExecOptions);
                const stream = await exec.start({
                    hijack: true, stdin: true
                });
                stream.on('data', (data: any) => {
                    console.log(data.toString());
                });
                await new Promise((resolve) => {
                    stream.on('end', resolve);
                });
                console.log('Sudoers file deleted successfully');
            } catch (execErr) { console.error('Error executing command:', execErr); }

            console.log('OK: 3');

            interface ViperInstanceResponse {
                container: {
                    id: string;
                    uuid: string;
                    url: string;
                };
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
                logs: [ { timestamp: new Date(), message: "Created"} ],
            });

            res.json({
                container: {
                    id: container.id,
                    uuid: instanceUUID,
                    url: instanceURL,
                }
            } as ViperInstanceResponse);
        } catch (err) {
            console.log('Error creating or starting container:', err);
            res.status(500).json({ error: 'Error creating or starting container', details: err });
        }
    } else {
        res.json({ "error": "Authentication" });
    }
});

router.get('/viperinstances', async (req: Request, res: Response) => {
    const user = req.user as User | undefined;
    if (user && user.role == 'admin') {
        try {
            const instances = await db.ViperInstance.findAll();
            res.json(instances);
        } catch (error) {
            console.error('Error retrieving viper instances:', error);
            res.status(500).send({ message: 'Error retrieving viper instances', error });
        }
    } else if (user && user.role != 'user') {
        try {
            const userId = user.id; // Assuming req.user.id holds the current user's ID
            const instances = await db.ViperInstance.findAll({
                where: {
                    owner: userId
                }
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
            interface TerminateInstanceResponse {
                [key: string]: any;
            }

            db.ViperInstance.findOne({
                where: {
                    dockerid: containerID
                }
            }).then((instance: any | null) => {
                if (!instance) {
                    console.error('Instance not found');
                    return; // Or throw an error if you prefer
                }

                instance.logs = [...instance.logs, { timestamp: new Date(), message: 'Status changed to deleted' }];
                instance.status = 'deleted';

                return instance.save(); // Save both the logs and the status
            }).then(() => {
                // console.log('Instance status updated to deleted.');
                ti_response["DATABASE"] = { 'Entry Updated': containerID };
                res.json(ti_response as TerminateInstanceResponse);
            }).catch((error: Error) => {
                // console.error('Error updating instance status:', error);
                ti_response["DATABASE"] = { 'Error': error };
                res.json(ti_response as TerminateInstanceResponse);
            });
        });
    });
});

router.get('/set-status-instance/:statuskey/:status', async (req, res) => {
    const _statuskey = req.params.statuskey;
    const _status = req.params.status;

    console.log(`SET-STATUS::::::: ${_statuskey} : ${_status}`);

    let ti_response: { [key: string]: any } = {}

    interface SetStatusInstanceResponse {
        [key: string]: any;
    }

    db.ViperInstance.findOne({
        where: {
            statusKey: _statuskey
        }
    }).then((instance: any | null) => {
        if (!instance) {
            console.error('Instance not found');
            return; // Or throw an error if you prefer
        }

        instance.logs = [...instance.logs, { timestamp: new Date(), message: 'Set Status to: ' + _status }];
        instance.status = _status; // Update the status as well

        return instance.save(); // Save both the logs and the status
    }).then(() => {
        ti_response["DATABASE"] = { 'Entry Updated': _statuskey };
        res.json(ti_response as SetStatusInstanceResponse);
    })
    .catch((error: Error) => {
        ti_response["DATABASE"] = { 'Error': error };
        res.json(ti_response as SetStatusInstanceResponse);
    });
      

});

export default router;