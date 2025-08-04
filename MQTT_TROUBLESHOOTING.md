# MQTT Troubleshooting Guide

If you're experiencing issues with MQTT connectivity in the Gemini Messenger application, follow these troubleshooting steps:

## Common MQTT Issues

1. **Connection Failures**
   - Check if your network allows WebSocket connections (port 443)
   - Ensure you have internet connectivity
   - Verify the MQTT broker URL is correct in your `.env` file

2. **Authentication Issues**
   - Verify your MQTT username and password are correct
   - Check if the broker requires additional authentication headers

3. **Message Delivery Problems**
   - Make sure you're subscribed to the correct topics
   - Check if QoS (Quality of Service) settings are appropriate
   - Verify that message format matches what the broker expects

## Configuration

1. Create a `.env` file in the project root with the following MQTT configuration:
   ```
   VITE_MQTT_BROKER_URL=wss://your-mqtt-broker-url.com/mqtt
   VITE_MQTT_USERNAME=your_username
   VITE_MQTT_PASSWORD=your_password
   ```

2. If you're using a self-signed certificate for the MQTT broker, you might need to set `rejectUnauthorized: false` in the MQTT client options (this is already done in the code).

## Debugging

1. **Enable Debug Mode**
   - Check the MQTT status indicator in the bottom-right corner (in development mode)
   - Click on the indicator to manually trigger a reconnection attempt

2. **Check Console Logs**
   - Open your browser's developer console (F12)
   - Look for logs with the prefix `[MQTT]` for MQTT-specific issues
   - Look for logs with the prefix `[App]` for application-level MQTT handling

3. **Test with Another MQTT Client**
   - Use tools like MQTT Explorer or the Mosquitto CLI client to test if your broker is accessible
   - Try publishing and subscribing to topics to verify broker functionality

## Advanced Troubleshooting

1. **Network Analysis**
   - Use browser network tools to check WebSocket connection status
   - Look for potential CORS issues if connecting to an external broker

2. **Browser Compatibility**
   - Some browsers may have restrictions on WebSocket connections
   - Try testing with Chrome, Firefox, or Edge

3. **Firewall/Proxy Issues**
   - Corporate firewalls might block WebSocket connections
   - Check if you need to use a different port or protocol
