function decodeHeltec(bytes) {
    var decoded = {};
 
    var payloadType = bytes[0];
 
    if (payloadType === 0x01) {
        var timestamp =
            (bytes[1] << 24) |
            (bytes[2] << 16) |
            (bytes[3] << 8) |
            bytes[4];
 
        var gps_count = bytes[5]; 
        decoded.gps_positions = [];
 
        var gps_offset = 6; 
        for (var i = 0; i < gps_count; i++) {
            var lat =
                (bytes[gps_offset] << 24) |
                (bytes[gps_offset + 1] << 16) |
                (bytes[gps_offset + 2] << 8) |
                bytes[gps_offset + 3];
            var lon =
                (bytes[gps_offset + 4] << 24) |
                (bytes[gps_offset + 5] << 16) |
                (bytes[gps_offset + 6] << 8) |
                bytes[gps_offset + 7];
 
            decoded.gps_positions.push({
                timestamp: timestamp + (60 * i), 
                latitude: (lat / Math.pow(10, 6)).toFixed(6),
                longitude: (lon / Math.pow(10, 6)).toFixed(6)
            });
 
            gps_offset += 8; 
        }
    }  
    else if (payloadType === 0x02) {
        // Type 2: Environmental data
        var num_samples = bytes[1]; 
 
        // Humidity (bytes 2-9)
        var hum_max = (bytes[2] << 8) | bytes[3];
        var hum_min = (bytes[4] << 8) | bytes[5];
        var hum_mean = (bytes[6] << 8) | bytes[7];
        var hum_std = (bytes[8] << 8) | bytes[9];
 
        // Pressure (bytes 10-17)
        var press_max = (bytes[10] << 8) | bytes[11];
        var press_min = (bytes[12] << 8) | bytes[13];
        var press_mean = (bytes[14] << 8) | bytes[15];
        var press_std = (bytes[16] << 8) | bytes[17];
 
        // Temperature (bytes 18-25)
        var temp_max = (bytes[18] << 8) | bytes[19];
        var temp_min = (bytes[20] << 8) | bytes[21];
        var temp_mean = (bytes[22] << 8) | bytes[23];
        var temp_std = (bytes[24] << 8) | bytes[25];
 
        decoded.num_samples = num_samples;
 
        decoded.temperature_max = parseFloat((temp_max * 0.005).toFixed(2));
        decoded.temperature_min = parseFloat((temp_min * 0.005).toFixed(2));
        decoded.temperature_mean = parseFloat((temp_mean * 0.005).toFixed(2));
        decoded.temperature_std = parseFloat((temp_std * 0.005).toFixed(2));
 
        decoded.humidity_max = parseFloat((hum_max * 0.0025).toFixed(2));
        decoded.humidity_min = parseFloat((hum_min * 0.0025).toFixed(2));
        decoded.humidity_mean = parseFloat((hum_mean * 0.0025).toFixed(2));
        decoded.humidity_std = parseFloat((hum_std * 0.0025).toFixed(2));
 
        decoded.pressure_max = parseFloat((press_max / 0.5 / 100).toFixed(2));
        decoded.pressure_min = parseFloat((press_min / 0.5 / 100).toFixed(2));
        decoded.pressure_mean = parseFloat((press_mean / 0.5 / 100).toFixed(2));
        decoded.pressure_std = parseFloat((press_std * 0.005).toFixed(2));
    } 
    else {
        decoded.error = "Unknown payload type";
    }
 
    return decoded;
}

module.exports = decodeHeltec;


