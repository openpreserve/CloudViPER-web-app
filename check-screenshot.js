const mysql = require('mysql2/promise');

async function checkScreenshot() {
    try {
        const connection = await mysql.createConnection({
            host: 'cloud-viper-mysqldb',
            user: 'viper_root',
            password: '111TX2vvhVifqRZCM6JkxkWknD4TLYszR7aD',
            database: 'viper_db_new'
        });

        const [rows] = await connection.execute(
            'SELECT uuid, lastScreenshot FROM ViperInstances WHERE uuid = "1zi4x8e5jlib"'
        );

        if (rows.length > 0) {
            const instance = rows[0];
            console.log('Instance found:', instance.uuid);
            
            if (instance.lastScreenshot) {
                const screenshotData = instance.lastScreenshot;
                console.log('Screenshot data keys:', Object.keys(screenshotData));
                
                if (screenshotData.screenshot) {
                    console.log('Screenshot data length:', screenshotData.screenshot.length);
                    console.log('Screenshot timestamp:', screenshotData.capturedAt);
                    console.log('Screenshot received at:', screenshotData.receivedAt);
                } else {
                    console.log('No screenshot field in data');
                    console.log('Available fields:', Object.keys(screenshotData));
                }
            } else {
                console.log('No lastScreenshot data');
            }
        } else {
            console.log('No instance found');
        }

        await connection.end();
    } catch (error) {
        console.error('Database error:', error.message);
    }
}

checkScreenshot();
