import mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';
import type { Message, User, MqttPayload } from '../types';

type MqttListener = (payload: MqttPayload, topic: string) => void;

class MqttService {
    private client: MqttClient | null = null;
    private listeners: MqttListener[] = [];
    private explicitDisconnect: boolean = false;
    private subscriptions: Set<string> = new Set();
    private publishQueue: { topic: string, payload: string }[] = [];

    private brokerUrl = 'wss://test.buildtrack.in/mqtt';
    
    private baseOptions: Omit<IClientOptions, 'host' | 'port' | 'protocol'> = {
        username: 'btmqtt',
        password: 'btmqtt123',
        reconnectPeriod: 1000,
        connectTimeout: 4000, // 4 seconds
    };

    public isConnected(): boolean {
        return this.client?.connected || false;
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
        if (this.client) {
            return;
        }

        this.explicitDisconnect = false;

        const connectOptions: IClientOptions = {
            ...this.baseOptions,
            clientId: `${user.id.replace(/\s/g, '_')}_${crypto.randomUUID().slice(0, 8)}`,
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
            console.log('[MQTT] Connected successfully.');
            console.log('[MQTT] Restoring subscriptions...');
            this.subscriptions.forEach(topic => this._performSubscribe(topic));
            this._processPublishQueue();
        });

        this.client.on('reconnect', () => {
            console.log('[MQTT] Reconnecting...');
        });
        
        this.client.on('close', () => {
            if (!this.explicitDisconnect) {
                console.warn('[MQTT] Connection closed. The client will attempt to reconnect automatically.');
            } else {
                console.log('[MQTT] Connection closed by user.');
            }
        });

        this.client.on('error', (error) => {
            console.error('[MQTT] Error:', error.message);
            // Do not call .end() here. The library handles reconnection.
            // It will emit 'close' and then attempt to reconnect based on `reconnectPeriod`.
        });
        
        this.client.on('message', (topic, payload) => {
            try {
                const parsedPayload = JSON.parse(payload.toString());
                if (parsedPayload.timestamp) {
                    parsedPayload.timestamp = new Date(parsedPayload.timestamp);
                }
                
                this.listeners.forEach(listener => listener(parsedPayload, topic));
            } catch (e) {
                console.error("[MQTT] Error parsing message:", e);
            }
        });
    }

    disconnect() {
        if (this.client) {
            this.explicitDisconnect = true;
            // Clear queues and subscriptions immediately on explicit disconnect
            this.subscriptions.clear();
            this.publishQueue = [];

            const oldClient = this.client;
            // By setting the client to null immediately, we prevent a race condition where
            // a new connection is attempted before the old one has fully closed. This was
            // causing "client disconnecting" errors on subscription attempts.
            this.client = null;

            oldClient.end(true, () => {
                console.log("[MQTT] Client disconnected.");
            });
        }
    }

    publish(topic: string, payload: MqttPayload | Record<string, any>) {
        const payloadString = JSON.stringify(payload);
        if (this.client && this.client.connected) {
            this.client.publish(topic, payloadString, (err) => {
                if (err) {
                    console.error(`[MQTT] Failed to publish message to ${topic}:`, err);
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
}

export const mqttService = new MqttService();