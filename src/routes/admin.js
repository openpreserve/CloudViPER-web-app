const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();
const { Op } = require('sequelize');

var Docker = require('dockerode');
var docker = new Docker({socketPath: '/var/run/docker.sock'});

const { getAvailablePort } = require('../utility/docker-port-generator.js');

const expressSession = require('express-session');
const MemoryStore = require('memorystore')(expressSession);

const sessionMW = expressSession({
    store: new MemoryStore({ checkPeriod: 86400000 }), // prune expired entries every 24h
    secret: process.env.APP_COOKIE_SECRET, // Replace with your own secret key
    resave: false,
    saveUninitialized: false,
});

router.use(sessionMW);
router.use( bodyParser.urlencoded({ extended: true}) );
const authenticate = require('../utility/authenticate');
const database = require('../utility/db.js');

function endOfDay(dateString) {
    const date = new Date(dateString);
    date.setHours(23, 59, 59, 999); // Set to the last millisecond of the day
    return date;
}

/* GET home page. */
router.get('/', authenticate, (req, res)=>{
    res.render('admin_index', {
        page_title: "ViPER Admin Portal",
        form_h1: "Admin Portal",
        form_p: "Search and tools", 
      });
});

router.get('/new-instance', async (req, res)=>{
    const availablePort = await getAvailablePort();
    const containerName = `viper-cloud-${availablePort}`;
    const portString = `${availablePort}/tcp`;

    console.log(portString);

    docker.createContainer({
        Image: 'opf-viper-cloud:v0.0.8',
        name: containerName,
        ExposedPorts: { '3000/tcp': {} },
        HostConfig: {
          PortBindings: { "3000/tcp": [{ "HostPort": availablePort }] },
        }
      }, (err, container) => {
        if (err) {
            console.log('err: 1');
            res.json({'error1':err});
        }
        //console.log(container);
        container.start((err, data) => {
          if (err) {
            res.json({'error2':err});
            console.log('err: 2');
          }
          console.log('OK: 3');
          console.log(data);
          res.json({'container': { id: container.id,
                                   port: availablePort}});
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

router.get('/login', (req,res)=>{
    res.render('login', {
        page_title: "Admin Login",
        form_h1: "Please Login to access content....",
        form_p: "", 
      });
});
router.post('/login', (req,res)=>{
    const admin_username = process.env.APP_USERNAME;
    const admin_password = process.env.APP_PASSWORD;

    if(admin_username==req.body.username && admin_password==req.body.password){
        req.session.is_admin = true;
        let redirectUrl = '/admin';
        if(req.cookies && req.cookies.redirect_url != undefined){
            redirectUrl = req.cookies.redirect_url;
        }
        
        res.clearCookie('redirect_url'); // Clear the cookie
        res.redirect(redirectUrl);
    }else{
        req.session.is_admin = false;
        res.status(401).redirect('/admin/login');
    }
});


module.exports = router;