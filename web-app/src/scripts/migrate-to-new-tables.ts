import db from '../models';
import winston from 'winston';

// Configure logger for migration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

async function migrateDataToNewTables() {
  try {
    logger.info('Starting migration to new tables...');

    // Get all ViperInstances with existing JSON data
    const instances = await db.ViperInstance.findAll({
      where: {},
      attributes: ['id', 'uuid', 'lastScreenshot', 'activityHistory']
    });

    logger.info(`Found ${instances.length} instances to migrate`);

    for (const instance of instances) {
      logger.info(`Migrating instance: ${instance.uuid}`);

      // Migrate screenshot data if it exists
      if (instance.lastScreenshot) {
        try {
          const screenshotData = typeof instance.lastScreenshot === 'string' 
            ? JSON.parse(instance.lastScreenshot) 
            : instance.lastScreenshot;

          if (screenshotData && screenshotData.screenshot) {
            // Create screenshot record
            await db.Screenshot.create({
              instanceId: instance.id!,
              instanceUUID: instance.uuid,
              screenshotData: screenshotData.screenshot,
              capturedAt: screenshotData.timestamp ? new Date(screenshotData.timestamp) : new Date()
            });

            logger.info(`Screenshot migrated for instance: ${instance.uuid}`);
          }
        } catch (error) {
          logger.error(`Error migrating screenshot for ${instance.uuid}:`, error);
        }
      }

      // Migrate activity history if it exists
      if (instance.activityHistory) {
        try {
          const activityData = typeof instance.activityHistory === 'string'
            ? JSON.parse(instance.activityHistory)
            : instance.activityHistory;

          if (Array.isArray(activityData)) {
            // Take only the last 100 entries (newest first)
            const recentActivities = activityData.slice(-100);

            for (const activity of recentActivities) {
              await db.Activity.create({
                instanceId: instance.id!,
                instanceUUID: instance.uuid,
                mouseEvents: activity.mouseEvents || 0,
                keyboardEvents: activity.keyboardEvents || 0,
                windowActive: activity.windowActive || false,
                cpuUsage: activity.cpuUsage || 0,
                memoryUsage: activity.memoryUsage || 0,
                activityScore: activity.activityScore || 0,
                reportedAt: activity.timestamp ? new Date(activity.timestamp) : new Date()
              });
            }

            logger.info(`${recentActivities.length} activity records migrated for instance: ${instance.uuid}`);
          }
        } catch (error) {
          logger.error(`Error migrating activity for ${instance.uuid}:`, error);
        }
      }
    }

    logger.info('Migration completed successfully!');
    logger.info('You can now safely remove the lastScreenshot and activityHistory columns from ViperInstances');

  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  migrateDataToNewTables()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateDataToNewTables };
