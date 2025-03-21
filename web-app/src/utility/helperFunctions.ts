const helperFunctions = {
    sanitizeUsername: (name: string): string => {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    },
    generateUsername: (email: string): string => {
        if (email.includes('@')) {
            const [emailName, domain] = email.split('@');
            return emailName.toLowerCase().replace(/[^a-z0-9]/g, '');
        } else {
            return email.toLowerCase().replace(/[^a-z0-9]/g, '');
        }
    },
    updateRoleIfAdmin: (email: string): string => {
        const domain = email.split('@')[1];
        if (domain === 'openpreservation.org') {
            return 'admin';
        }
        return 'user';
    },
    generateRandomString: (length: number): string => {
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
};

export default helperFunctions;