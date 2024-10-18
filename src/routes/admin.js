const express = require('express');
const router = express.Router();
const dotenv = require('dotenv').config();
const { Op } = require('sequelize');

var Docker = require('dockerode');
var docker = new Docker({socketPath: '/var/run/docker.sock'});

const { getAvailablePort } = require('../utility/docker-port-generator.js');

const authenticate = require('../utility/authenticate');
const database = require('../utility/db.js');
const { generateRandomString } = require('../utility/helperFunctions.js');

/* GET home page. */
router.get('/', authenticate, (req, res)=>{
    res.render('admin_index', {
        page_title: "ViPER Admin Portal",
        form_h1: "Admin Portal",
        form_p: "Manage container instances", 
      });
});

router.get('/new-instance', async (req, res)=>{
    // const availablePort = await getAvailablePort();
    // const portString = `${availablePort}/tcp`;

    const instanceUUID = generateRandomString(12);
    const instanceURL = `${instanceUUID}.${process.env.APP_HOST}`;
    const containerName = `viper-cloud-${instanceUUID}`;

    const envVars = [
      "VIRTUAL_PORT=3000",
      "VIRTUAL_HOST="+instanceURL,
      "LETSENCRYPT_HOST="+instanceURL,
      "LETSENCRYPT_EMAIL=sysadmin@openpreservation.org",
    ];

    console.log(instanceUUID);

    docker.createContainer({
        Image: 'darrendignam/opf-viper-cloud:v0.0.10',
        name: containerName,
        ExposedPorts: { '3000/tcp': {},'3001/tcp': {} },
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
            res.json({'error1':err});
        }
        //console.log(container);
        container.start((err, data) => {
          if (err) {
            console.log('err: 2');
            console.log(err);
            // res.json({'error2':err});
            console.log('err: 2');
          }
          console.log('OK: 3');
          console.log(data);
          res.json({'container': { id: container.id,
                                   uuid: instanceUUID,
                                   url: instanceURL,
                                  }});
        });
      });
});

router.get('/terminate-instance/:containerId', async (req, res)=>{
  const containerID = req.params.containerId;
  console.log(containerID);
  const container = docker.getContainer(containerID);

  let ti_response = {}

  container.stop((err, data) => {
    if (err) {
      ti_response["STOP-ERROR"] =  {'Error stopping container': err} ;
    }
    console.log('Container stopped:', data);
  
    // Remove the container
    container.remove((err, data) => {
      if (err) {
        ti_response["REMOVE-ERROR"] =  {'Error removing container': err};
      } 
      ti_response["REMOVE"] = {'Container removed': data};
      res.json(ti_response);
    });
  });
});

// router.get('/all', async (req,res)=>{
//     const data = await database.NPS.findAll();
//     res.json(data);
// });

module.exports = router;