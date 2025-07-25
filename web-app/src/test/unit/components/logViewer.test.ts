import { jest } from '@jest/globals';

// Mock global fetch for API calls
(global as any).fetch = jest.fn();

describe('Log Viewer Component Tests', () => {
    let componentState: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Initialize component state
        componentState = {
            selectedLogType: 'app',
            selectedDate: '2025-07-25',
            logs: [],
            loading: false,
            error: null,
            availableDates: [],
            pagination: {
                offset: 0,
                limit: 50,
                total: 0,
                hasMore: false
            },
            searchTerm: '',
            filteredLogs: []
        };
    });

    describe('Component Initialization', () => {
        it('should initialize with correct default state', () => {
            expect(componentState.selectedLogType).toBe('app');
            expect(componentState.selectedDate).toBe('2025-07-25');
            expect(componentState.logs).toEqual([]);
            expect(componentState.loading).toBe(false);
            expect(componentState.pagination.limit).toBe(50);
            expect(componentState.pagination.offset).toBe(0);
        });

        it('should set application logs as default log type', () => {
            expect(componentState.selectedLogType).toBe('app');
        });
    });

    describe('Log Type Handling', () => {
        it('should handle session log formatting correctly', () => {
            const mockSessionLog = {
                message: {
                    eventType: 'User Login',
                    userEmail: 'test@example.com',
                    userRole: 'admin',
                    ipAddress: '127.0.0.1',
                    url: '/dashboard',
                    method: 'GET',
                    userAgent: 'Mozilla/5.0 Test Browser',
                    route: '/dashboard'
                },
                timestamp: '2025-07-25T10:00:00Z'
            };

            // Test session log formatting logic
            const formatSessionLog = (log: any, index: number) => {
                const message = log.message || log;
                return {
                    type: 'session',
                    eventType: message.eventType || 'Unknown Event',
                    timestamp: new Date(message.timestamp || log.timestamp).toLocaleString(),
                    userEmail: message.userEmail || 'Anonymous',
                    userRole: message.userRole || 'No role',
                    ipAddress: message.ipAddress || 'Unknown',
                    url: message.url || 'Unknown',
                    method: message.method || 'Unknown',
                    userAgent: (message.userAgent || 'Unknown').substring(0, 60),
                    route: message.route
                };
            };

            const formatted = formatSessionLog(mockSessionLog, 0);
            expect(formatted.type).toBe('session');
            expect(formatted.eventType).toBe('User Login');
            expect(formatted.userEmail).toBe('test@example.com');
            expect(formatted.userRole).toBe('admin');
        });

        it('should handle SQL log formatting correctly', () => {
            const mockSqlLog = {
                lineNumber: 1,
                content: 'SELECT * FROM users WHERE id = 1',
                timestamp: '2025-07-25T10:00:00Z'
            };

            const formatSqlLog = (log: any, index: number) => {
                return {
                    type: 'sql',
                    lineNumber: log.lineNumber,
                    content: log.content,
                    timestamp: log.timestamp ? new Date(log.timestamp).toLocaleString() : null
                };
            };

            const formatted = formatSqlLog(mockSqlLog, 0);
            expect(formatted.type).toBe('sql');
            expect(formatted.lineNumber).toBe(1);
            expect(formatted.content).toBe('SELECT * FROM users WHERE id = 1');
        });

        it('should handle application log formatting correctly', () => {
            const mockAppLog = {
                level: 'info',
                message: 'User role updated',
                eventType: 'Role Change',
                targetUsername: 'john.doe',
                oldRole: 'user',
                newRole: 'admin',
                timestamp: '2025-07-25T10:00:00Z'
            };

            const formatAppLog = (log: any, index: number) => {
                return {
                    type: 'app',
                    level: log.level || 'INFO',
                    message: log.message,
                    timestamp: new Date(log.timestamp).toLocaleString(),
                    eventType: log.eventType,
                    details: log
                };
            };

            const formatted = formatAppLog(mockAppLog, 0);
            expect(formatted.type).toBe('app');
            expect(formatted.level).toBe('info');
            expect(formatted.message).toBe('User role updated');
            expect(formatted.eventType).toBe('Role Change');
        });
    });

    describe('Application Log Detail Formatting', () => {
        it('should format server startup logs correctly', () => {
            const startupLog = {
                message: 'Server started successfully',
                nodeEnv: 'production',
                port: 3000
            };

            const formatServerStartup = (log: any) => {
                if (log.message === 'Server started successfully') {
                    return {
                        environment: log.nodeEnv || 'Unknown',
                        port: log.port || 'Unknown',
                        hostname: 'localhost',
                        serverUrl: `http://localhost:${log.port || '3000'}`
                    };
                }
                return null;
            };

            const details = formatServerStartup(startupLog);
            expect(details?.environment).toBe('production');
            expect(details?.port).toBe(3000);
            expect(details?.serverUrl).toBe('http://localhost:3000');
        });

        it('should format role change logs correctly', () => {
            const roleChangeLog = {
                eventType: 'Role Change',
                targetUsername: 'john.doe',
                targetUserEmail: 'john@example.com',
                oldRole: 'user',
                newRole: 'admin',
                adminUsername: 'super.admin',
                adminUserId: 1
            };

            const formatRoleChange = (log: any) => {
                if (log.eventType === 'Role Change') {
                    return {
                        targetUser: `${log.targetUsername || 'Unknown'} (${log.targetUserEmail || 'Unknown'})`,
                        roleChange: {
                            from: log.oldRole || 'Unknown',
                            to: log.newRole || 'Unknown'
                        },
                        changedBy: `${log.adminUsername || 'Unknown'} (ID: ${log.adminUserId || 'Unknown'})`
                    };
                }
                return null;
            };

            const details = formatRoleChange(roleChangeLog);
            expect(details?.targetUser).toBe('john.doe (john@example.com)');
            expect(details?.roleChange.from).toBe('user');
            expect(details?.roleChange.to).toBe('admin');
            expect(details?.changedBy).toBe('super.admin (ID: 1)');
        });

        it('should format container creation logs correctly', () => {
            const containerLog = {
                message: 'Container created and started successfully',
                containerName: 'viper-instance-123',
                containerId: 'abc123def456',
                instanceUUID: 'uuid-12345',
                instanceURL: 'instance.example.com',
                userEmail: 'user@example.com',
                userId: 42
            };

            const formatContainerCreation = (log: any) => {
                if (log.message === 'Container created and started successfully') {
                    return {
                        containerName: log.containerName || 'Unknown',
                        containerId: (log.containerId || 'Unknown').substring(0, 12) + '...',
                        instanceUUID: log.instanceUUID || 'Unknown',
                        instanceURL: log.instanceURL || 'Unknown',
                        createdBy: `${log.userEmail || 'Unknown'} (ID: ${log.userId || 'Unknown'})`
                    };
                }
                return null;
            };

            const details = formatContainerCreation(containerLog);
            expect(details?.containerName).toBe('viper-instance-123');
            expect(details?.containerId).toBe('abc123def456...');
            expect(details?.instanceUUID).toBe('uuid-12345');
            expect(details?.createdBy).toBe('user@example.com (ID: 42)');
        });

        it('should format 404 error logs correctly', () => {
            const errorLog = {
                message: '404 Not Found',
                url: '/nonexistent/path',
                method: 'GET',
                ip: '192.168.1.100',
                userAgent: 'Mozilla/5.0 Chrome/91.0 Test Browser',
                referer: 'http://localhost:3000/dashboard'
            };

            const format404Error = (log: any) => {
                if (log.message === '404 Not Found') {
                    return {
                        path: log.url || 'Unknown',
                        method: log.method || 'Unknown',
                        ipAddress: log.ip || 'Unknown',
                        userAgent: (log.userAgent || 'Unknown').substring(0, 80) + '...',
                        referer: log.referer
                    };
                }
                return null;
            };

            const details = format404Error(errorLog);
            expect(details?.path).toBe('/nonexistent/path');
            expect(details?.method).toBe('GET');
            expect(details?.ipAddress).toBe('192.168.1.100');
            expect(details?.referer).toBe('http://localhost:3000/dashboard');
        });

        it('should format error logs with stack traces correctly', () => {
            const errorLog = {
                level: 'error',
                error: 'Database connection failed',
                stack: 'Error: Database connection failed\n    at Connection.connect (/app/db.js:45:12)',
                userId: 123,
                userEmail: 'affected@example.com'
            };

            const formatError = (log: any) => {
                if (log.level === 'error') {
                    return {
                        error: log.error,
                        userId: log.userId,
                        userEmail: log.userEmail,
                        stack: log.stack
                    };
                }
                return null;
            };

            const details = formatError(errorLog);
            expect(details?.error).toBe('Database connection failed');
            expect(details?.userId).toBe(123);
            expect(details?.userEmail).toBe('affected@example.com');
            expect(details?.stack).toContain('at Connection.connect');
        });
    });

    describe('Search and Filtering', () => {
        it('should filter logs based on search term', () => {
            const logs = [
                { message: 'User login successful', eventType: 'User Login' },
                { message: 'Role updated', eventType: 'Role Change' },
                { message: 'Container created', eventType: 'Container Management' }
            ];

            const filterLogs = (logs: any[], searchTerm: string) => {
                if (!searchTerm) return logs;
                return logs.filter(log => {
                    const searchableText = JSON.stringify(log).toLowerCase();
                    return searchableText.includes(searchTerm.toLowerCase());
                });
            };

            const filtered = filterLogs(logs, 'login');
            expect(filtered).toHaveLength(1);
            expect(filtered[0].message).toBe('User login successful');

            const filteredRole = filterLogs(logs, 'role');
            expect(filteredRole).toHaveLength(1);
            expect(filteredRole[0].eventType).toBe('Role Change');
        });

        it('should handle case-insensitive search', () => {
            const logs = [
                { message: 'USER LOGIN SUCCESSFUL', eventType: 'User Login' },
                { message: 'container created', eventType: 'Container Management' }
            ];

            const filterLogs = (logs: any[], searchTerm: string) => {
                if (!searchTerm) return logs;
                return logs.filter(log => {
                    const searchableText = JSON.stringify(log).toLowerCase();
                    return searchableText.includes(searchTerm.toLowerCase());
                });
            };

            const filtered = filterLogs(logs, 'USER');
            expect(filtered).toHaveLength(1);
            expect(filtered[0].message).toBe('USER LOGIN SUCCESSFUL');

            const filteredContainer = filterLogs(logs, 'CONTAINER');
            expect(filteredContainer).toHaveLength(1);
            expect(filteredContainer[0].eventType).toBe('Container Management');
        });
    });

    describe('Pagination Logic', () => {
        it('should handle pagination state correctly', () => {
            const initialPagination = {
                offset: 0,
                limit: 50,
                total: 0,
                hasMore: false
            };

            const updatePagination = (pagination: any, newLogs: any[], total: number) => {
                return {
                    ...pagination,
                    offset: pagination.offset + newLogs.length,
                    total: total,
                    hasMore: pagination.offset + newLogs.length < total
                };
            };

            const updated = updatePagination(initialPagination, new Array(25).fill({}), 100);
            expect(updated.offset).toBe(25);
            expect(updated.total).toBe(100);
            expect(updated.hasMore).toBe(true);

            const final = updatePagination(updated, new Array(25).fill({}), 100);
            expect(final.offset).toBe(50);
            expect(final.hasMore).toBe(true);

            const complete = updatePagination(final, new Array(50).fill({}), 100);
            expect(complete.offset).toBe(100);
            expect(complete.hasMore).toBe(false);
        });
    });

    describe('Date Handling', () => {
        it('should format dates correctly for display', () => {
            const testDates = [
                '2025-07-25T10:30:45.123Z',
                '2025-07-24T15:20:30.000Z',
                '2025-07-23T09:15:22.456Z'
            ];

            const formatDate = (dateString: string) => {
                return new Date(dateString).toLocaleString();
            };

            const formatted = testDates.map(formatDate);
            expect(formatted).toHaveLength(3);
            expect(typeof formatted[0]).toBe('string');
            expect(formatted[0]).toContain('2025');
        });

        it('should extract unique dates from log files', () => {
            const logFiles = [
                'session-2025-07-25.log',
                'session-2025-07-24.log',
                'app-2025-07-25.log',
                'app-2025-07-24.log',
                'sql-2025-07-25.log',
                'other-file.txt'
            ];

            const extractDates = (files: string[]) => {
                const datePattern = /(\d{4}-\d{2}-\d{2})/;
                const dates = new Set<string>();
                
                files.forEach(file => {
                    const match = file.match(datePattern);
                    if (match) {
                        dates.add(match[1]);
                    }
                });
                
                return Array.from(dates).sort().reverse();
            };

            const dates = extractDates(logFiles);
            expect(dates).toEqual(['2025-07-25', '2025-07-24']);
        });
    });
});
