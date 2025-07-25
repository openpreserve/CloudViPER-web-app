#!/usr/bin/env node

/**
 * Session Log Viewer
 * A simple script to view session logs in a more readable format
 */

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');
const today = new Date().toISOString().split('T')[0];
const sessionLogFile = path.join(logsDir, `session-${today}.log`);

console.log(`\n📊 Session Log Viewer - ${today}\n`);
console.log(`Reading from: ${sessionLogFile}\n`);

if (!fs.existsSync(sessionLogFile)) {
    console.log('❌ No session log file found for today.');
    process.exit(1);
}

const logContent = fs.readFileSync(sessionLogFile, 'utf8');
const lines = logContent.trim().split('\n').filter(line => line.length > 0);

if (lines.length === 0) {
    console.log('📝 No session events logged today.');
    process.exit(0);
}

console.log(`📋 Total Events: ${lines.length}\n`);

lines.forEach((line, index) => {
    try {
        const logEntry = JSON.parse(line);
        const message = logEntry.message;
        
        console.log(`🔸 Event #${index + 1} - ${message.eventType}`);
        console.log(`   Time: ${new Date(message.timestamp).toLocaleString()}`);
        console.log(`   IP: ${message.ipAddress || 'Unknown'}`);
        console.log(`   User Agent: ${(message.userAgent || 'Unknown').substring(0, 80)}...`);
        console.log(`   URL: ${message.url || 'Unknown'}`);
        console.log(`   Session ID: ${message.sessionId || 'Unknown'}`);
        console.log(`   User: ${message.userEmail || 'Anonymous'} (${message.userRole || 'No role'})`);
        console.log(`   Method: ${message.method || 'Unknown'} | Protocol: ${message.protocol || 'Unknown'}`);
        console.log(`   Secure: ${message.secure} | XHR: ${message.xhr}`);
        
        if (message.route) {
            console.log(`   Route: ${message.route}`);
        }
        
        console.log('');
    } catch (error) {
        console.log(`❌ Error parsing log entry ${index + 1}: ${error.message}`);
    }
});

console.log(`\n✅ Displayed ${lines.length} session events.`);
