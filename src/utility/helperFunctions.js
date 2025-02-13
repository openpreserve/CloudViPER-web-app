
module.exports = {
    sanitizeUsername : (name)=> {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    },
    updateRoleIfAdmin : (email) => {
        const domain = email.split('@')[1];
        if (domain === 'openpreservation.org') {
            return 'admin';
        }
        return 'user';
    },
    generateRandomString : (length) => {
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
          result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    },

    /* Wrapper for the exec syntax for docker containers */
    runExec : async (container, command, echo_log ) => {
        const exec = await container.exec({
            Cmd: command,
            AttachStdout: true,
            AttachStderr: true,
        })
    
        return new Promise((resolve, reject) => {
            exec.start({}, (err, stream) => {
                if (stream) {
                    stream.setEncoding('utf-8')
                    stream.on('data', console.log)
                    stream.on('end', resolve)
                }
            })
        })
    }

                // // Execute the commands to enable screen captures
                // try {
                //     await runExec(container, ['sh', '/usr/local/share/scripts/install_scrot.sh'], false);
                // } catch (execErr) { console.error('Error executing command:', execErr); }
                
                // try {
                //     await runExec(container, ['sh', '-c', 'chmod 0644 /etc/cron.d/screenshot_cron_job && crontab /etc/cron.d/screenshot_cron_job && /etc/init.d/cron restart' ], false);
                // } catch (execErr) { console.error('Error executing command:', execErr); }

                // // Execute the command to delete the abc sudoers file 
                // try {
                //     await runExec(container, ['rm', '-f', '/etc/sudoers.d/abc'], false);
                // } catch (execErr) { console.error('Error executing command:', execErr); }

                // // Execute the command to remove abc from the sudo group 
                // try {
                //     await runExec(container, ['gpasswd', '-d', 'abc', 'sudo'], false);
                // } catch (execErr) { console.error('Error executing command:', execErr); }    


};