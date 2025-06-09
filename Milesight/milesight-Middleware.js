const mqtt = require('mqtt');
const { Client } = require('pg');
const decodeWS523 = require('./decoder-WS523');
const decodeAT101 = require('./decoder-AT101');
const decodeHeltec = require('../Heltec/decoder-Heltec');


// PostgreSQL client setup
const pgClient = new Client({
  host: 'apiivm78.etsii.upm.es',
  port: 5432,
  user: 'amir',
  password: 'UPM#2024',
  database: 'netmore-iot'
});

pgClient.connect();

// MQTT client setup
const client = mqtt.connect('mqtts://mq.netmoregroup.com:8883', {
  username: 'j.ordieres@upm',
  password: 'Ordieres#2024',
  clientId: 'j.ordieres@upm-example'
});

client.on('connect', function () {
  console.log("Connected to MQTT broker.");
  client.subscribe('sensor/upm/upm_ordieres/payload', function (err, granted) {
    if (err) {
      console.log("Subscription error:", err);
    } else {
      console.log("Subscribed to:", granted.map(g => g.topic).join(", "));
    }
  });
});

// client.on('message', (topic, message) => {
//   const jsonMessage = JSON.parse(message.toString())[0]; 

//   let decodedData;
//   if (jsonMessage.sensorType === "milesight_ws523") {
//     const bytes = Buffer.from(jsonMessage.payload, 'hex');
//     decodedData = decodeWS523(bytes);
//     insertWS523Data(jsonMessage, decodedData);
//     //new
//     sendDataToThingsBoard(decodedData, jsonMessage);  
//     //
//   } else if (jsonMessage.sensorType === "other") {
//     try {
//       const bytes = Buffer.from(jsonMessage.payload, 'hex');
//       if (bytes.length === 0) {
//         console.log('Empty or invalid payload');
//         return;
//       }
//       decodedData = decodeAT101(bytes);
//       insertAT101Data(jsonMessage, decodedData);
//       //new
//     sendDataToThingsBoard(decodedData, jsonMessage);  
//     //
//     } catch (error) {
//       console.log('Decoding failed:', error);
//       return;
//     }
//   } else {
//     console.log('Unknown sensor type:', jsonMessage.sensorType);
//     return;
//   }
// });

client.on('message', (topic, message) => {
  const jsonMessage = JSON.parse(message.toString())[0]; 

  let decodedData;
  if (jsonMessage.sensorType === "milesight_ws523") {
    const bytes = Buffer.from(jsonMessage.payload, 'hex');
    decodedData = decodeWS523(bytes);
    insertWS523Data(jsonMessage, decodedData);
    sendDataToThingsBoard(decodedData, jsonMessage); 
  } else if (jsonMessage.sensorType === "other") {
    const bytes = Buffer.from(jsonMessage.payload, 'hex');
    if (bytes.length === 0) {
      console.log('Empty or invalid payload');
      return;
    }
    if (jsonMessage.devEui === "24e124745d197898") {
      decodedData = decodeAT101(bytes);
      insertAT101Data(jsonMessage, decodedData);
    } else if (jsonMessage.devEui === "70b3d57ed8003bf7") {
      decodedData = decodeHeltec(bytes);
      // insertHeltecData(jsonMessage, decodedData);
      console.log(decodedData);
    } else {
      console.log('Unknown device EUI:', jsonMessage.devEui);
      return;
    }
    sendDataToThingsBoard(decodedData, jsonMessage); 
  } else {
    console.log('Unknown sensor type:', jsonMessage.sensorType);
    return;
  }
});

function insertWS523Data(message, data) {
    const query = `
      INSERT INTO ws523_data(devEui, timestamp, rssi, snr, gatewayIdentifier, active_power, current, power_consumption, power_factor, socket_status, voltage)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
    `;
    const values = [
      message.devEui, new Date(message.timestamp), message.rssi, message.snr, message.gatewayIdentifier,
      data.active_power, data.current, data.power_consumption, data.power_factor, data.socket_status, data.voltage
    ];
    pgClient.query(query, values)
      .then(res => console.log('Data inserted for WS523 successfully'))
      .catch(err => console.error('Error executing WS523 insert query', err.stack));
  }
  
  function insertAT101Data(message, data) {
    const query = `
      INSERT INTO at101_data(devEui, timestamp, rssi, snr, gatewayIdentifier, battery, geofence_status, longitude, latitude, motion_status, position, temperature)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
    `;
    const values = [
      message.devEui, new Date(message.timestamp), message.rssi, message.snr, message.gatewayIdentifier,
      data.battery, data.geofence_status, data.longitude, data.latitude, data.motion_status, data.position, data.temperature
    ];
    pgClient.query(query, values)
      .then(res => console.log('Data inserted for AT101 successfully'))
      .catch(err => console.error('Error executing AT101 insert query', err.stack));
  }


  function insertHeltecData(message, data) {
    const query = `
      INSERT INTO heltec_data_new(devEui, timestamp, rssi, snr, gatewayIdentifier, temperature_last, humidity_last, pressure_last, temperature_max, temperature_min, temperature_mean, temperature_std, humidity_max, humidity_min, humidity_mean, humidity_std, pressure_max, pressure_min, pressure_mean, pressure_std, latitude, longitude, altitude, satellites, hdop)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25);
    `;
    const values = [
      message.devEui, new Date(message.timestamp), message.rssi, message.snr, message.gatewayIdentifier,
      data.temperature_last, data.humidity_last, data.pressure_last, data.temperature_max, data.temperature_min, data.temperature_mean, data.temperature_std, data.humidity_max, data.humidity_min, data.humidity_mean, data.humidity_std, data.pressure_max, data.pressure_min, data.pressure_mean, data.pressure_std, data.latitude, data.longitude, data.altitude, data.satellites, data.hdop
    ];
    pgClient.query(query, values)
      .then(res => console.log('Data inserted for Heltec successfully'))
      .catch(err => console.error('Error executing Heltec insert query', err.stack));
  }


client.on('error', function (error) {
  console.log("Connection error:", error);
});

//--------------------ThingBoards
const axios = require('axios');


const deviceTokens = {
  "24e124148d157034": "Ltce73SrO01CKneGlRcy",
  "24e124148d156857": "64tnvrswc8zrct1irgwl",
  "24e124745d197898": "1ccW7hbErAfDH6mtE6a9",
  "70b3d57ed8003bf7": "r0Um7uUiQFdcN4KEJJzo"
};

function sendDataToThingsBoard(data, message) {
  const devEUI=message.devEui;
  const accessToken = deviceTokens[devEUI];
  if (!accessToken) {
      console.error('No access token found for device:', devEUI);
      return;
  }

 // Initialize the telemetry data with common fields
 let telemetryData = {
  devEui: message.devEui,
  timestamp: new Date(message.timestamp).toISOString(), // Ensure timestamp is in ISO format
  rssi: message.rssi,
  snr: message.snr,
  gatewayIdentifier: message.gatewayIdentifier
};

// Add device-specific telemetry data
if (message.sensorType === "milesight_ws523") {
  telemetryData = {
      ...telemetryData,
      active_power: data.active_power,
      current: data.current,
      power_consumption: data.power_consumption,
      power_factor: data.power_factor,
      socket_status: data.socket_status,
      voltage: data.voltage
  };
} else if (message.sensorType === "other") {
  telemetryData = {
      ...telemetryData,
      battery: data.battery,
      geofence_status: data.geofence_status,
      longitude: data.longitude,
      latitude: data.latitude,
      motion_status: data.motion_status,
      position: data.position,
      temperature: data.temperature
  };
}

const url = `https://thingsboard-pi.etsii.upm.es/api/v1/${accessToken}/telemetry`;
axios.post(url, telemetryData, { headers: { 'Content-Type': 'application/json' } })
    .then(response => {
      console.log(`Data sent to ThingsBoard for device ${devEUI}:`, response.data);
    })
    .catch(error => {
      console.error(`Failed to send data to ThingsBoard for device ${devEUI}:`, error.response ? error.response.data : error.message);
    });
}