
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
      }
};