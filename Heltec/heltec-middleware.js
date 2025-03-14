const mqtt = require('mqtt');
const { Client } = require('pg');
const decodeHeltec = require('./decoder-Heltec');
const { spawn } = require('child_process'); 



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



client.on('message', (topic, message) => {
  try{
  const jsonMessage = JSON.parse(message.toString())[0]; 

  let decodedData;
  const bytes = Buffer.from(jsonMessage.payload, 'hex');

  if (jsonMessage.devEui === "70b3d57ed8003bf7") {
    decodedData = decodeHeltec(bytes);
    console.log("Decoded data:", decodedData);

    insertHeltecData(jsonMessage, decodedData);
    sendDataToThingsBoard(decodedData, jsonMessage); 

    const dataString = JSON.stringify(decodedData);
    const pythonInterpreter = '/home/amirf/NetMore/venv/bin/python'; 
    const pythonScript = '/home/amirf/NetMore/Heltec/transaction.py';
    const pythonProcess = spawn(pythonInterpreter, [pythonScript, dataString]);


    pythonProcess.stdout.on('data', (data) => {
      console.log(`transaction.py output: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`transaction.py error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`transaction.py process exited with code ${code}`);
    });

  } else {
    console.log('Unknown device EUI:', jsonMessage.devEui);
    return;
  }
}catch (err) {
  console.error("Error processing MQTT message:", err);
}
});

  //Inset to PostgreSQL/////////////
  function insertHeltecData(message, data) {
    const query = `
      INSERT INTO heltec_data(
        devEui,
        timestamp,
        rssi,
        snr,
        gatewayIdentifier,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, $6);
    `;
    const values = [
      message.devEui,
      new Date(message.timestamp),  
      message.rssi,
      message.snr,
      message.gatewayIdentifier,
      JSON.stringify(data)  
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
  "70b3d57ed8003bf7": "r0Um7uUiQFdcN4KEJJzo"
};

function sendDataToThingsBoard(data, message) {
  const devEUI=message.devEui;
  const accessToken = deviceTokens[devEUI];
  if (!accessToken) {
      console.error('No access token found for device:', devEUI);
      return;
  }

 const baseTelemetry = {
  devEui: message.devEui,
  timestamp: new Date(message.timestamp).toISOString(), 
  rssi: message.rssi,
  snr: message.snr,
  gatewayIdentifier: message.gatewayIdentifier,
  temperature_max: data.temperature_max,
  temperature_min: data.temperature_min,
  temperature_mean: data.temperature_mean,
  temperature_std: data.temperature_std,
  humidity_max: data.humidity_max,
  humidity_min: data.humidity_min,
  humidity_mean: data.humidity_mean,
  humidity_std: data.humidity_std,
  pressure_max: data.pressure_max,
  pressure_min: data.pressure_min,
  pressure_mean: data.pressure_mean,
  pressure_std: data.pressure_std,
};

const url = `https://thingsboard-pi.etsii.upm.es/api/v1/${accessToken}/telemetry`;

axios.post(url, baseTelemetry, { headers: { 'Content-Type': 'application/json' } })
    .then(response => {
        console.log(`Base telemetry sent for device ${devEUI}:`, response.data);
    })
    .catch(error => {
        console.error(`Failed to send base telemetry for device ${devEUI}:`, error.response ? error.response.data : error.message);
    });

// Send each GPS position as a separate telemetry entry
if (data.gps_positions && data.gps_positions.length > 0) {
    data.gps_positions.forEach(gps => {
        let gpsTelemetry = {
            latitude: parseFloat(gps.latitude),
            longitude: parseFloat(gps.longitude),
            timestamp: new Date(gps.timestamp * 1000).toISOString() 
        };

        axios.post(url, gpsTelemetry, { headers: { 'Content-Type': 'application/json' } })
            .then(response => {
                console.log(`GPS data sent for device ${devEUI}:`, response.data);
            })
            .catch(error => {
                console.error(`Failed to send GPS data for device ${devEUI}:`, error.response ? error.response.data : error.message);
            });
    });
}
}



