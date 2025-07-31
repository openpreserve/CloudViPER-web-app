import fs from 'fs';
import path from 'path';

interface ScriptTemplateVariables {
    INSTANCE_UUID: string;
    SERVICE_URL: string;
    DOMAIN_NAME: string;
    STATUS_KEY: string;
}

/**
 * Read a script file and substitute template variables
 */
export function readAndProcessScript(scriptName: string, variables: ScriptTemplateVariables): string {
    const scriptsDir = path.join(__dirname, '../../scripts');
    const scriptPath = path.join(scriptsDir, scriptName);
    
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Script file not found: ${scriptPath}`);
    }
    
    let scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Replace template variables
    Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        scriptContent = scriptContent.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return scriptContent;
}

/**
 * Get all available script files
 */
export function getAvailableScripts(): string[] {
    const scriptsDir = path.join(__dirname, '../../scripts');
    
    if (!fs.existsSync(scriptsDir)) {
        return [];
    }
    
    return fs.readdirSync(scriptsDir).filter(file => 
        file.endsWith('.sh') || 
        file.endsWith('.service') || 
        file.endsWith('.desktop')
    );
}

/**
 * Validate that required scripts exist
 */
export function validateRequiredScripts(): { valid: boolean; missing: string[] } {
    const requiredScripts = [
        'viper-monitor.sh',
        'viper-monitor.service', 
        'viper-monitor.desktop'
    ];
    
    const scriptsDir = path.join(__dirname, '../../scripts');
    const missing: string[] = [];
    
    requiredScripts.forEach(script => {
        const scriptPath = path.join(scriptsDir, script);
        if (!fs.existsSync(scriptPath)) {
            missing.push(script);
        }
    });
    
    return {
        valid: missing.length === 0,
        missing
    };
}
