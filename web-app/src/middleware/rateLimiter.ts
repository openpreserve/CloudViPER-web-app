import { Request, Response, NextFunction } from 'express';
import { appLogger } from '../config/logger';

interface RateLimitEntry {
    count: number;
    firstRequest: number;
    lastRequest: number;
}

class RateLimiter {
    private requests: Map<string, RateLimitEntry> = new Map();
    private windowMs: number;
    private maxRequests: number;
    private cleanupInterval: NodeJS.Timeout;

    constructor(windowMs: number = 60000, maxRequests: number = 5) {
        this.windowMs = windowMs; // 1 minute default
        this.maxRequests = maxRequests; // 5 requests per minute default
        
        // Clean up old entries every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.requests.entries()) {
            if (now - entry.lastRequest > this.windowMs) {
                this.requests.delete(key);
            }
        }
    }

    private getKey(req: Request): string {
        // Use user ID if authenticated, otherwise fall back to IP
        const user = req.user as any;
        if (user && user.id) {
            return `user:${user.id}`;
        }
        return `ip:${req.ip}`;
    }

    middleware() {
        return (req: Request, res: Response, next: NextFunction): void => {
            const key = this.getKey(req);
            const now = Date.now();
            
            let entry = this.requests.get(key);
            
            if (!entry) {
                // First request from this key
                entry = {
                    count: 1,
                    firstRequest: now,
                    lastRequest: now
                };
                this.requests.set(key, entry);
                next();
                return;
            }

            // Check if we're still within the time window
            if (now - entry.firstRequest < this.windowMs) {
                if (entry.count >= this.maxRequests) {
                    // Rate limit exceeded
                    const user = req.user as any;
                    
                    appLogger.warn('Rate limit exceeded', {
                        eventType: 'Rate Limit Exceeded',
                        userId: user?.id || 'unknown',
                        userRole: user?.role || 'unknown',
                        endpoint: req.path,
                        method: req.method,
                        ipAddress: req.ip,
                        requestCount: entry.count,
                        windowMs: this.windowMs,
                        maxRequests: this.maxRequests,
                        timestamp: new Date().toISOString()
                    });

                    res.status(429).json({
                        error: 'Rate limit exceeded',
                        message: `Too many requests. Maximum ${this.maxRequests} requests per ${this.windowMs / 1000} seconds.`,
                        retryAfter: Math.ceil((this.windowMs - (now - entry.firstRequest)) / 1000)
                    });
                    return;
                }
                
                // Increment counter
                entry.count++;
                entry.lastRequest = now;
            } else {
                // Window has expired, reset counter
                entry.count = 1;
                entry.firstRequest = now;
                entry.lastRequest = now;
            }

            next();
        };
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.requests.clear();
    }
}

// Create rate limiters for different endpoints
export const instanceCreationLimiter = new RateLimiter(300000, 3); // 3 requests per 5 minutes
export const generalApiLimiter = new RateLimiter(60000, 30); // 30 requests per minute
export const authLimiter = new RateLimiter(900000, 5); // 5 auth attempts per 15 minutes

export default RateLimiter;
