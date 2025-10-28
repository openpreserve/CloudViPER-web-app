/**
 * Admin User Initialization
 * 
 * This utility creates an initial admin user on first deployment if no admin exists.
 * Used for Google Marketplace deployments to ensure zero-manual-intervention setup.
 */

import db from '../models';
import { UserRole } from '../types/UserRole';
import { appLogger } from '../config/logger';

export async function initializeAdminUser(): Promise<void> {
    try {
        // Check if any admin user already exists
        const adminUsers = await db.User.findAll({
            where: {
                role: UserRole.ADMIN
            }
        });

        if (adminUsers.length > 0) {
            appLogger.info('Admin user already exists, skipping initialization', {
                adminCount: adminUsers.length,
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Get initial admin credentials from environment variables
        const initialUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin';
        const initialEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@example.com';
        const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMeOnFirstLogin123!';

        // Check if user with this email already exists
        const existingUser = await db.User.findOne({
            where: { email: initialEmail }
        });

        if (existingUser) {
            appLogger.warn('User with admin email already exists but is not an admin', {
                email: initialEmail,
                existingRole: existingUser.role,
                timestamp: new Date().toISOString()
            });
            
            // Upgrade existing user to admin
            existingUser.role = UserRole.ADMIN;
            await existingUser.save();
            
            appLogger.info('Upgraded existing user to admin role', {
                userId: existingUser.id,
                email: existingUser.email,
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Create new admin user
        const adminUser = await db.User.register({
            username: initialUsername,
            email: initialEmail,
            role: UserRole.ADMIN,
            team: 'none'
        }, initialPassword);

        appLogger.info('Initial admin user created successfully', {
            userId: adminUser.id,
            username: adminUser.username,
            email: adminUser.email,
            role: adminUser.role,
            timestamp: new Date().toISOString()
        });

        console.log('═══════════════════════════════════════════════════');
        console.log('✓ Initial admin user created successfully');
        console.log(`  Username: ${initialUsername}`);
        console.log(`  Email:    ${initialEmail}`);
        console.log(`  Password: ${initialPassword}`);
        console.log('  ⚠ IMPORTANT: Change the password after first login!');
        console.log('═══════════════════════════════════════════════════');

    } catch (error) {
        appLogger.error('Failed to initialize admin user', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
        
        // Don't throw - allow app to start even if admin creation fails
        // This prevents deployment failures due to DB issues
        console.error('⚠ WARNING: Failed to create initial admin user:', error);
        console.error('The application will continue, but you may need to manually create an admin user.');
    }
}
