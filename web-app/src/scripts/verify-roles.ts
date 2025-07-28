/**
 * Verification script to check role enumeration and database compatibility
 */

import { UserRole, getAllRoles, isValidRole, toUserRole, RoleDescriptions } from '../types/UserRole';
import db from '../models';

async function verifyRoles() {
    console.log('🔍 Role Enumeration Verification\n');
    
    // Display all available roles
    console.log('📋 Available Roles:');
    getAllRoles().forEach(role => {
        console.log(`  • ${role}: ${RoleDescriptions[role]}`);
    });
    
    console.log('\n🧪 Testing Role Validation:');
    
    // Test valid roles
    const testRoles = ['user', 'testing', 'member', 'subscriber', 'admin'];
    testRoles.forEach(role => {
        const isValid = isValidRole(role);
        const converted = toUserRole(role);
        console.log(`  ${role}: Valid=${isValid}, Converted=${converted}`);
    });
    
    // Test invalid roles
    const invalidRoles = ['invalid', 'moderator', ''];
    console.log('\n❌ Testing Invalid Roles:');
    invalidRoles.forEach(role => {
        const isValid = isValidRole(role);
        const converted = toUserRole(role);
        console.log(`  "${role}": Valid=${isValid}, Converted=${converted} (fallback)`);
    });
    
    // Check database connection and current user roles
    try {
        await db.sequelize.authenticate();
        console.log('\n💾 Database Connection: ✅ Connected');
        
        // Get current role distribution
        const users = await db.User.findAll({
            attributes: ['role', [db.sequelize.fn('COUNT', db.sequelize.col('role')), 'count']],
            group: ['role'],
            raw: true
        });
        
        console.log('\n📊 Current Role Distribution:');
        users.forEach((user: any) => {
            const isValidCurrentRole = isValidRole(user.role);
            console.log(`  ${user.role}: ${user.count} users ${isValidCurrentRole ? '✅' : '❌ INVALID'}`);
        });
        
        // Test creating a user with enum validation
        console.log('\n🧪 Testing Database Validation:');
        
        try {
            // This should work
            const testUser = await db.User.build({
                username: 'test_enum_user',
                email: 'test@example.com',
                role: UserRole.TESTING,
                oauthProvider: 'test'
            });
            
            console.log('  ✅ Valid role accepted:', testUser.role);
            
            // Test validation without saving
            await testUser.validate();
            console.log('  ✅ Role validation passed');
            
        } catch (error) {
            console.log('  ❌ Validation error:', (error as Error).message);
        }
        
        try {
            // This should fail
            const invalidUser = await db.User.build({
                username: 'test_invalid_user',
                email: 'test2@example.com',
                role: 'invalid_role' as any,
                oauthProvider: 'test'
            });
            
            await invalidUser.validate();
            console.log('  ❌ Invalid role was incorrectly accepted');
            
        } catch (error) {
            console.log('  ✅ Invalid role correctly rejected:', (error as Error).message);
        }
        
    } catch (error) {
        console.log('💾 Database Connection: ❌ Failed');
        console.log('Error:', (error as Error).message);
    }
    
    console.log('\n✨ Role verification complete!');
}

// Run verification if this script is executed directly
if (require.main === module) {
    verifyRoles().then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    });
}

export default verifyRoles;
