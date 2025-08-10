import mqtt from 'mqtt';
import type { IClientOptions, MqttClient } from 'mqtt';
import { generateShortUUID } from '@/utils/uuidUtils';
import type { User, MqttPayload } from '../types';
import { DatabaseService } from './databaseService';

type MqttListener = (payload: MqttPayload, topic: string) => void;

class MqttService {
    private client: MqttClient | null = null;
    private listeners: MqttListener[] = [];
    private explicitDisconnect: boolean = false;
    private subscriptions: Set<string> = new Set();
    private publishQueue: { topic: string, payload: string }[] = [];
    private currentUser: User | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
    private lastPresenceStatus: 'online' | 'offline' | null = null;
    private lastPresenceUpdateAt: number = 0;
    private readonly presenceUpdateThrottleMs: number = 5 * 60 * 1000; // 5 minutes

    // Use environment variable or fallback to default broker URL
    private brokerUrl = import.meta.env.VITE_MQTT_BROKER_URL || 'wss://test.buildtrack.in/mqtt';
    
    private baseOptions: Omit<IClientOptions, 'host' | 'port' | 'protocol'> = {
        username: import.meta.env.VITE_MQTT_USERNAME || 'btmqtt',
        password: import.meta.env.VITE_MQTT_PASSWORD || 'btmqtt123',
        reconnectPeriod: 5000, // Increase reconnect period to 5 seconds
        connectTimeout: 10000, // Increase timeout to 10 seconds
        keepalive: 60, // Keep connection alive with pings
        rejectUnauthorized: false, // Bypass SSL certificate validation issues (consider true for production)
    };

    public isConnected(): boolean {
        return this.client?.connected || false;
    }
    
    public getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' | 'error' {
        return this.connectionStatus;
    }
    
    /**
     * Checks the connection and attempts to reconnect if needed
     * @returns Promise that resolves when connection check is complete
     */
    public async checkConnection(): Promise<boolean> {
        if (this.client?.connected) {
            console.log('[MQTT] Connection check: Already connected');
            this.connectionStatus = 'connected';
            return true;
        }
        
        if (!this.currentUser) {
            console.log('[MQTT] Connection check: No user available, cannot reconnect');
            return false;
        }
        
        console.log('[MQTT] Connection check: Attempting reconnection');
        this.connectionStatus = 'connecting';
        
        // Clear any existing reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        // Disconnect if there's a partial connection
        if (this.client) {
            console.log('[MQTT] Connection check: Cleaning up existing client');
            this.disconnect();
        }
        
        // Create a promise that resolves when connected or after timeout
        return new Promise((resolve) => {
            // Set a timeout to resolve with failure after 10 seconds
            const timeout = setTimeout(() => {
                console.log('[MQTT] Connection check: Timed out waiting for connection');
                this.connectionStatus = 'error';
                resolve(false);
            }, 10000);
            
            // Create a one-time connect listener
            const connectHandler = () => {
                if (this.client) {
                    this.client.removeListener('connect', connectHandler);
                    clearTimeout(timeout);
                    this.connectionStatus = 'connected';
                    resolve(true);
                }
            };
            
            // Connect and listen for the connect event
            if (this.currentUser) {
                this.connect(this.currentUser);
                if (this.client) {
                    this.client.once('connect', connectHandler);
                } else {
                    clearTimeout(timeout);
                    this.connectionStatus = 'error';
                    resolve(false);
                }
            } else {
                clearTimeout(timeout);
                console.error('[MQTT] Connection check: No user available for connection');
                this.connectionStatus = 'error';
                resolve(false);
            }
        });
    }

    private _performSubscribe(topic: string) {
        if (!this.client || !this.client.connected) {
            console.warn(`[MQTT] Cannot subscribe to ${topic}, client not connected.`);
            return;
        }
        this.client.subscribe(topic, (err) => {
            if (err) {
                console.error(`[MQTT] Failed to subscribe to ${topic}:`, err.message);
            } else {
                console.log(`[MQTT] Subscribed to ${topic}`);
            }
        });
    }

    public unsubscribe(topic: string) {
        // Remove from our desired subscription set
        if (this.subscriptions.has(topic)) {
            this.subscriptions.delete(topic);
        }

        // If connected, unsubscribe at the broker too
        if (this.client && this.client.connected) {
            this.client.unsubscribe(topic, (err) => {
                if (err) {
                    console.error(`[MQTT] Failed to unsubscribe from ${topic}:`, err.message);
                } else {
                    console.log(`[MQTT] Unsubscribed from ${topic}`);
                }
            });
        } else {
            console.log(`[MQTT] Queued unsubscription for topic: ${topic} (will take effect on next connect)`);
        }
    }

    private _processPublishQueue() {
        if (!this.client || !this.client.connected) return;

        const queue = [...this.publishQueue];
        this.publishQueue = [];

        if (queue.length > 0) {
            console.log(`[MQTT] Processing ${queue.length} queued messages.`);
        }
        
        queue.forEach(item => {
            // Re-call publish, which will now use the connected client
            this.publish(item.topic, JSON.parse(item.payload));
        });
    }

    connect(user: User) {
        // Store the current user for reconnection purposes
        this.currentUser = user;
        this.connectionStatus = 'connecting';
        
        console.log(`[MQTT] Connect called for user: ${user.id}`);
        console.log(`[MQTT] Broker URL: ${this.brokerUrl}`);
        console.log(`[MQTT] Username: ${this.baseOptions.username}`);
        
        if (this.client) {
            console.log('[MQTT] Client already exists, checking connection status...');
            if (this.client.connected) {
                console.log('[MQTT] Already connected.');
                this.connectionStatus = 'connected';
                return;
            } else {
                console.log('[MQTT] Client exists but not connected. Recreating connection...');
                this.disconnect();
            }
        }

        this.explicitDisconnect = false;

        // Use our utility function that already has fallback built in
        const randomId = generateShortUUID();

        const connectOptions: IClientOptions = {
            ...this.baseOptions,
            clientId: `${user.id.replace(/\s/g, '_')}_${randomId}`,
            // Add a will message to notify when client disconnects unexpectedly
            will: {
                topic: `user/${user.id}/status`,
                payload: JSON.stringify({ status: 'offline', timestamp: new Date().toISOString() }),
                qos: 1,
                retain: true
            }
        };
        
        console.log(`[MQTT] Attempting to connect to broker at ${this.brokerUrl} with clientId: ${connectOptions.clientId}`);

        try {
            this.client = mqtt.connect(this.brokerUrl, connectOptions);
        } catch (error) {
            console.error("[MQTT] Connection error on initialization:", error);
            this.client = null;
            return;
        }

        this.client.on('connect', () => {
            console.log('[MQTT] Connected successfully!');
            console.log(`[MQTT] Client ID: ${connectOptions.clientId}`);
            console.log(`[MQTT] Broker: ${this.brokerUrl}`);
            this.connectionStatus = 'connected';

            // Publish user online status
            this.publish(`user/${user.id}/status`, {
                status: 'online',
                timestamp: new Date().toISOString()
            });

            // Update user status in the database on connect if changed or throttled interval passed
            this.updatePresenceInDatabase('online');

            // Start heartbeat to keep user status updated
            this.startHeartbeat();

            console.log('[MQTT] Restoring subscriptions...');
            this.subscriptions.forEach(topic => this._performSubscribe(topic));
            this._processPublishQueue();
        });

        this.client.on('reconnect', () => {
            console.log('[MQTT] Reconnecting...');
            // Custom logic: process queued messages and load unread messages
            // You may need to inject dependencies or use listeners/callbacks for these
            if (typeof window !== 'undefined' && (window as any).processQueuedMessages) {
                try {
                    (window as any).processQueuedMessages();
                    console.log('[MQTT] Queued messages processed on reconnect.');
                } catch (err) {
                    console.error('[MQTT] Error processing queued messages on reconnect:', err);
                }
            }
            if (typeof window !== 'undefined' && (window as any).loadUnreadMessages) {
                try {
                    (window as any).loadUnreadMessages();
                    console.log('[MQTT] Unread messages loaded on reconnect.');
                } catch (err) {
                    console.error('[MQTT] Error loading unread messages on reconnect:', err);
                }
            }
        });
        
        // Handle client going offline
        this.client.on('offline', () => {
            const reason = 'MQTT client is offline (network or broker issue)';
            console.log(`[MQTT] Client is offline. Reason: ${reason} Will attempt to reconnect automatically.`);
            this.connectionStatus = 'disconnected';
            // Only set offline if not already online and not reconnecting
            if (this.currentUser && !this.explicitDisconnect) {
                // Check if client is really offline (not just reconnecting)
                if (!this.client?.reconnecting) {
                    console.info(`[MQTT] Setting user status to offline in database. Reason: ${reason}`);
                    this.updatePresenceInDatabase('offline');
                } else {
                    console.log('[MQTT] Offline event during reconnect, not setting user offline.');
                }
            }
        });
        
        this.client.on('close', () => {
            if (!this.explicitDisconnect) {
                const reason = 'MQTT connection closed unexpectedly';
                console.warn(`[MQTT] Connection closed. Reason: ${reason} The client will attempt to reconnect automatically.`);
                // Only set offline if not reconnecting
                if (this.currentUser && !this.client?.reconnecting) {
                    console.info(`[MQTT] Setting user status to offline in database. Reason: ${reason}`);
                    this.updatePresenceInDatabase('offline');
                } else {
                    console.log('[MQTT] Close event during reconnect, not setting user offline.');
                }
            } else {
                console.log('[MQTT] Connection closed by user.');
            }
        });

        this.client.on('error', (error) => {
            console.error('[MQTT] Connection error:', error);
            console.error('[MQTT] Error type:', typeof error);
            console.error('[MQTT] Error message:', error.message);
            this.connectionStatus = 'error';

            // Log reason and set user offline
            const reason = `MQTT error: ${error?.message || 'unknown'}`;
            if (this.currentUser) {
                console.info(`[MQTT] Setting user status to offline in database. Reason: ${reason}`);
                this.updatePresenceInDatabase('offline');
            }

            // Additional error details for debugging
            const mqttError = error as { code?: string; errno?: number; syscall?: string };
            if (mqttError.code) {
                console.error(`[MQTT] Error code: ${mqttError.code}`);
            }
            if (mqttError.errno) {
                console.error(`[MQTT] Error number: ${mqttError.errno}`);
            }
            if (mqttError.syscall) {
                console.error(`[MQTT] System call: ${mqttError.syscall}`);
            }

            // On critical errors, attempt to reconnect manually after a delay
            if (mqttError.code === 'ECONNREFUSED' || mqttError.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
                console.log('[MQTT] Critical connection error. Will attempt manual reconnection in 10 seconds.');
                setTimeout(() => {
                    if (this.client && this.currentUser) {
                        console.log('[MQTT] Starting manual reconnection...');
                        this.client.end(true, () => {
                            this.client = null;
                            console.log('[MQTT] Attempting manual reconnection after error...');
                            this.connect(this.currentUser!);
                        });
                    }
                }, 10000);
            }
            // Do not call .end() here for other errors. The library handles reconnection.
        });
        
        this.client.on('message', (topic, payload) => {
            try {
                const payloadStr = payload.toString();
                console.log(`[MQTT] Received message on topic: ${topic}, payload: ${payloadStr.substring(0, 100)}${payloadStr.length > 100 ? '...' : ''}`);
                
                const parsedPayload = JSON.parse(payloadStr);
                
                // Convert ISO date strings to Date objects
                if (parsedPayload.timestamp) {
                    parsedPayload.timestamp = new Date(parsedPayload.timestamp);
                }
                
                // Notify all listeners
                this.listeners.forEach(listener => {
                    try {
                        listener(parsedPayload, topic);
                    } catch (listenerError) {
                        console.error(`[MQTT] Error in message listener: ${listenerError}`);
                    }
                });
            } catch (e) {
                console.error("[MQTT] Error parsing message:", e);
                console.error("[MQTT] Problem payload:", payload.toString().substring(0, 200));
            }
        });
    }

    disconnect() {
        if (this.client) {
            this.explicitDisconnect = true;
            this.connectionStatus = 'disconnected';
            console.log("[MQTT] Starting disconnection process...");
            
            // Stop heartbeat timer
            this.stopHeartbeat();
            
            // Clear queues and subscriptions immediately on explicit disconnect
            this.subscriptions.clear();
            this.publishQueue = [];

            // Best-effort beacon to mark offline quickly on abrupt closes
            try {
                if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator && this.currentUser) {
                    const beaconUrl = (import.meta as any)?.env?.VITE_OFFLINE_STATUS_BEACON_URL;
                    if (beaconUrl) {
                        const payload = {
                            userId: this.currentUser.id,
                            status: 'offline',
                            timestamp: new Date().toISOString()
                        };
                        // Use text/plain to maximize sendBeacon success; function accepts both
                        const ok = (navigator as any).sendBeacon(
                            beaconUrl,
                            new Blob([JSON.stringify(payload)], { type: 'text/plain' })
                        );
                        console.log('[MQTT] sendBeacon offline status', ok ? 'queued' : 'failed');
                    }
                }
            } catch (e) {
                console.error('[MQTT] Beacon send failed:', e);
            }

            const oldClient = this.client;
            // By setting the client to null immediately, we prevent a race condition where
            // a new connection is attempted before the old one has fully closed
            this.client = null;

            // Publish offline status before disconnecting (if connected)
            if (oldClient.connected) {
                try {
                    // Get user ID from clientId (this is a workaround since we don't have user object here)
                    const clientId = oldClient.options.clientId as string;
                    const userId = clientId.split('_')[0]; // Extract user ID from client ID
                    
                    // Update user status in database
                    this.updatePresenceInDatabase('offline', userId);
                    
                    // Also publish status via MQTT for real-time notification to other clients
                    oldClient.publish(
                        `user/${userId}/status`, 
                        JSON.stringify({ status: 'offline', timestamp: new Date().toISOString() }),
                        { qos: 1, retain: true },
                        () => {
                            // After status is published, end the connection
                            oldClient.end(true, () => {
                                console.log("[MQTT] Client disconnected successfully.");
                            });
                        }
                    );
                } catch (error) {
                    console.error("[MQTT] Error during disconnect:", error);
                    // Still end the connection even if there was an error
                    oldClient.end(true, () => {
                        console.log("[MQTT] Client disconnected after error.");
                    });
                }
            } else {
                // If not connected, just end the client
                oldClient.end(true, () => {
                    console.log("[MQTT] Client disconnected (was not connected).");
                });
            }
        } else {
            console.log("[MQTT] Disconnect called but no client exists.");
        }
    }

    publish(topic: string, payload: MqttPayload | Record<string, any>) {
        // Create a safe copy of the payload
        const payloadCopy = { ...payload };
        
        // Ensure timestamp is in ISO format string for consistent serialization
        if ('timestamp' in payloadCopy && payloadCopy.timestamp instanceof Date) {
            payloadCopy.timestamp = payloadCopy.timestamp.toISOString();
        }
        
        const payloadString = JSON.stringify(payloadCopy);
        
        if (this.client && this.client.connected) {
            console.log(`[MQTT] Publishing to ${topic}: ${payloadString.substring(0, 100)}${payloadString.length > 100 ? '...' : ''}`);
            
            this.client.publish(topic, payloadString, { qos: 1 }, (err) => {
                if (err) {
                    console.error(`[MQTT] Failed to publish message to ${topic}:`, err);
                    // Queue the message for retry
                    this.publishQueue.push({ topic, payload: payloadString });
                    
                    // If multiple publish failures, we may have connection issues
                    if (this.publishQueue.length > 5) {
                        console.warn(`[MQTT] Multiple publish failures (${this.publishQueue.length} queued). Connection may be unstable.`);
                    }
                } else {
                    console.log(`[MQTT] Successfully published to ${topic}`);
                }
            });
        } else {
            console.warn(`[MQTT] Client not connected. Queuing message for topic: ${topic}`);
            this.publishQueue.push({ topic, payload: payloadString });
        }
    }

    subscribe(topic: string) {
        if (this.subscriptions.has(topic)) {
            return;
        }
        this.subscriptions.add(topic);
        if (this.client && this.client.connected) {
            this._performSubscribe(topic);
        } else {
            console.log(`[MQTT] Queued subscription for topic: ${topic}`);
        }
    }

    addListener(listener: MqttListener) {
        this.listeners.push(listener);
    }

    removeListener(listener: MqttListener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }
    
    /**
     * Test MQTT connection (for debugging purposes)
     */
    public testConnection() {
        console.log('[MQTT] Testing connection...');
        console.log(`[MQTT] Broker URL: ${this.brokerUrl}`);
        console.log(`[MQTT] Username: ${this.baseOptions.username}`);
        console.log(`[MQTT] Current status: ${this.connectionStatus}`);
        console.log(`[MQTT] Client connected: ${this.client?.connected || false}`);
        console.log(`[MQTT] Active subscriptions: ${Array.from(this.subscriptions).join(', ')}`);
        console.log(`[MQTT] Queued messages: ${this.publishQueue.length}`);
        
        // Try to reconnect if needed
        if (this.currentUser && !this.isConnected()) {
            console.log('[MQTT] Attempting to reconnect...');
            this.checkConnection();
        }
    }
    
    /**
     * Test basic MQTT connectivity without authentication
     */
    public testBasicConnection() {
        console.log('[MQTT] Testing basic connection without auth...');
        
        try {
            const testClient = mqtt.connect(this.brokerUrl, {
                clientId: `test_${generateShortUUID()}`,
                connectTimeout: 5000,
                keepalive: 30
            });
            
            testClient.on('connect', () => {
                console.log('[MQTT] Basic test connection successful!');
                testClient.end();
            });
            
            testClient.on('error', (error) => {
                console.error('[MQTT] Basic test connection failed:', error);
                testClient.end();
            });
            
            setTimeout(() => {
                if (!testClient.connected) {
                    console.warn('[MQTT] Basic test connection timed out');
                    testClient.end();
                }
            }, 10000);
            
        } catch (error) {
            console.error('[MQTT] Failed to create test client:', error);
        }
    }
    
    /**
     * Start the heartbeat to periodically update user status
     * This ensures the user stays "online" even when not actively using the chat
     */
    private startHeartbeat() {
        // Clear any existing heartbeat timer
        this.stopHeartbeat();
        
        // Only start heartbeat if we have a user and a connected client
        if (!this.currentUser || !this.client?.connected) return;
        
        console.log('[MQTT] Starting user presence heartbeat');
        
        this.heartbeatTimer = setInterval(() => {
            if (this.currentUser && this.client?.connected) {
                // Publish online status to MQTT
                this.publish(`user/${this.currentUser.id}/status`, { 
                    status: 'online', 
                    timestamp: new Date().toISOString() 
                });
                // Throttled presence write
                this.updatePresenceInDatabase('online');
            } else {
                // Stop heartbeat if client is no longer connected
                this.stopHeartbeat();
            }
        }, 60000); // Update every minute
    }

    /**
     * Helper: write presence to DB only when changed or throttled interval passed
     */
    private updatePresenceInDatabase(nextStatus: 'online' | 'offline', overrideUserId?: string) {
        const userId = overrideUserId || this.currentUser?.id;
        if (!userId) return;

        const now = Date.now();
        const statusChanged = this.lastPresenceStatus !== nextStatus;
        const throttled = now - this.lastPresenceUpdateAt >= this.presenceUpdateThrottleMs;
        if (!statusChanged && !throttled) {
            return; // Skip unnecessary API call
        }

        DatabaseService.updateUserStatus(userId, nextStatus)
            .then(success => {
                if (success) {
                    this.lastPresenceStatus = nextStatus;
                    this.lastPresenceUpdateAt = now;
                    console.log(`[MQTT] User status updated to ${nextStatus} in database`);
                } else {
                    console.error(`[MQTT] Failed to update user status to ${nextStatus}`);
                }
            })
            .catch(error => {
                console.error('[MQTT] Error updating user status:', error);
            });
    }

    constructor() {
        // Attach unload handlers so we always try to go offline on tab close
        if (typeof window !== 'undefined') {
            const handleUnload = () => {
                try { this.disconnect(); } catch {}
            };
            window.addEventListener('beforeunload', handleUnload);
            window.addEventListener('unload', handleUnload);
        }
    }
    
    /**
     * Stop the heartbeat timer
     */
    private stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
            console.log('[MQTT] Stopped user presence heartbeat');
        }
    }
}

export const mqttService = new MqttService();

// Make MQTT service available globally for debugging (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any).mqttService = mqttService;
}