const express = require('express');
const router = express.Router();
const dotenv = require('dotenv').config();
const { Op } = require('sequelize');

var Docker = require('dockerode');
var docker = new Docker({ socketPath: '/var/run/docker.sock' });

const { getAvailablePort } = require('../utility/docker-port-generator.js');

const authenticate = require('../utility/authenticate.js');
const database = require('../utility/db.js');
const { generateRandomString } = require('../utility/helperFunctions.js');

/*
ROLES:

user - nothing
testing - can run one viper
member - can run one viper
subscriber - pays for use
admin - viper and user management

*/

/* GET home page. */
router.get('/', (req, res) => {
    if (req.user) {
        switch (req.user.role) {
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


    // res.render('admin_index', {
    //     page_title: "ViPER Admin Portal",
    //     form_h1: "Admin Portal",
    //     form_p: "Manage container instances", 
    //   });
});

router.get('/admin', (req, res) => {
    // res.json({msg:"Welcome traveller"});
    if (req.user && req.user.role == 'admin') {
        res.render('service_admin');
    } else {
        res.redirect('/service');
    }
});
router.get('/testing', (req, res) => {
    if (req.user && req.user.role == 'testing') {
        res.render('service_testing');
    } else {
        res.redirect('/service');
    }
});
router.get('/member', (req, res) => {
    if (req.user && req.user.role == 'member') {
        res.render('service_member');
    } else {
        res.redirect('/service');
    }
});

router.get('/new-instance', async (req, res) => {
    // const availablePort = await getAvailablePort();
    // const portString = `${availablePort}/tcp`;

    if (req.user && req.user.role != 'user') {
        const ownerId = req.user.id;

        const instanceUUID = generateRandomString(12);
        const instanceURL = `${instanceUUID}.${process.env.APP_HOST}`;
        const containerName = `viper-cloud-${instanceUUID}`;
        console.log(instanceUUID);

        const envVars = [
            "VIRTUAL_PORT=3000",
            "VIRTUAL_HOST=" + instanceURL,
            "LETSENCRYPT_HOST=" + instanceURL,
            "LETSENCRYPT_EMAIL=sysadmin@openpreservation.org",
            "PUID=1000",
            "PGID=1000",
        ];

        docker.createContainer({
            Image: 'darrendignam/opf-viper-cloud:v0.0.10',
            name: containerName,
            HostConfig: {
                ShmSize: 1024 * 1024 * 1024,
                Binds: ['/var/viper-docker-project/volumes/test-corpus/test-root/corpora:/config/Desktop/test-corpus:ro'],
                // PortBindings: { '3000/tcp': [{ HostPort: '3000' }] },
            },
            ExposedPorts: { '3000/tcp': {}, '3001/tcp': {} },
            NetworkingConfig: {
                EndpointsConfig: {
                    'ingress-proxy': {}
                }
            },
            Env: envVars,
            // // this was good for localhost, not so much here:
            // HostConfig: {
            //   PortBindings: { "3000/tcp": [{ "HostPort": availablePort }] },
            // }
        }, (err, container) => {
            if (err) {
                console.log('err: 1:');
                console.log(err);
                res.json({ 'error1': err });
            }
            //console.log(container);
            container.start(async (err, data) => {
                if (err) {
                    console.log('err: 2');
                    console.log(err);
                    // res.json({'error2':err});
                    console.log('err: 2');
                }
                console.log('OK: 3');
                console.log(data);
                database.ViperInstance.create({
                    uuid: instanceUUID,
                    dockerid: container.id,
                    name: containerName,
                    url: instanceURL,
                    owner: ownerId,
                }).then((newViperInstance) => {
                    res.json({
                        'container': {
                            id: container.id,
                            uuid: instanceUUID,
                            url: instanceURL,
                        }
                    });
                }).catch((error) => {
                    res.status(500).json({ error: 'Error creating ViperInstance', details: error });

                });
            });
        });
    } else {
        res.json({ "error": "Authentication" })
    }
});

router.get('/viperinstances', async (req, res) => {
    if (req.user && req.user.role == 'admin') {
        try {
            const instances = await database.ViperInstance.findAll();
            res.json(instances);
        } catch (error) {
            console.error('Error retrieving viper instances:', error);
            res.status(500).send({ message: 'Error retrieving viper instances', error });
        }
    }else if(req.user && req.user.role != 'user') {
        try {
            const userId = req.user.id; // Assuming req.user.id holds the current user's ID
            const instances = await database.ViperInstance.findAll({
            where: {
                owner: userId
            }
            });
            res.json(instances);
        } catch (error) {
            console.error('Error retrieving viper instances:', error);
            res.status(500).send({ message: 'Error retrieving viper instances', error });
        }
    }else{
        res.status(403).send({ message: 'Error 4' });
    }

});

router.get('/terminate-instance/:containerId', async (req, res) => {
    const containerID = req.params.containerId;
    console.log(containerID);
    const container = docker.getContainer(containerID);

    let ti_response = {}

    container.stop((err, data) => {
        if (err) {
            ti_response["STOP-ERROR"] = { 'Error stopping container': err };
        }
        console.log('Container stopped:', data);

        // Remove the container
        container.remove((err, data) => {
            if (err) {
                ti_response["REMOVE-ERROR"] = { 'Error removing container': err };
            }
            ti_response["REMOVE"] = { 'Container removed': data };
            // res.json(ti_response);

            database.ViperInstance.destroy({
                where: {
                  dockerid: containerID
                }
              })
              .then(() => {
                // console.log('Instance removed successfully.');
                ti_response["DATABASE"] = {'Entry Removed':containerID};
                res.json(ti_response);
              })
              .catch(error => {
                // console.error('Error removing instance:', error);
                ti_response["DATABASE"] = {'Error':error};
                res.json(ti_response);
              });
              
        });
    });
});

module.exports = router;