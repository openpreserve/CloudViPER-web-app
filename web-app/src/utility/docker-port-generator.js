const Docker = require('dockerode');
const docker = new Docker();

function generateRandomNumber() {
  return Math.floor(1000 + Math.random() * 9000);
}

async function isPortInUse(port) {
  const containers = await docker.listContainers();
  for (const container of containers) {
    const data = await docker.getContainer(container.Id).inspect();
    const ports = data.NetworkSettings.Ports;
    for (const portKey in ports) {
      if (ports.hasOwnProperty(portKey)) {
        const hostPort = ports[portKey][0].HostPort;
        if (parseInt(hostPort) === port) {
          return true;
        }
      }
    }
  }
  return false;
}

async function getAvailablePort() {
//   let port;
//   let portInUse = true;

//   while (portInUse) {
//     port = generateRandomNumber();
//     portInUse = await isPortInUse(port);
//   }

//   return port.toString();
    port = generateRandomNumber();
    return '3' + port;

}

module.exports = { getAvailablePort };
