import os
import sys
import json
import time
import hashlib
from iota_sdk import Wallet, ClientOptions, StrongholdSecretManager, CoinType, Utils
from iota_sdk.types.transaction_options import TransactionOptions, TaggedDataPayload

# Configuration
NODE_URL = "https://api.testnet.iotaledger.net"
STRONGHOLD_SNAPSHOT_PATH = "vault.stronghold"
STRONGHOLD_PASSWORD = "UPM#2025"
ACCOUNT_ALIAS = "UPM"

# Initialize wallet
secret_manager = StrongholdSecretManager(STRONGHOLD_SNAPSHOT_PATH, STRONGHOLD_PASSWORD)
client_options = ClientOptions(nodes=[NODE_URL])
wallet = Wallet(client_options=client_options, coin_type=CoinType.SHIMMER, secret_manager=secret_manager)

def get_or_create_account(alias: str):
    accounts = wallet.get_accounts()
    for acc in accounts:
        if acc.get_metadata().alias == alias:
            print(f"Using existing account: {alias}")
            return acc
    print(f"🔹 Creating new account: {alias}")
    mnemonic = Utils.generate_mnemonic()
    wallet.store_mnemonic(mnemonic)
    return wallet.create_account(alias)

def validate_sensor_data(data):
    if not isinstance(data, dict):
        raise ValueError("Sensor data must be a JSON dictionary")
    return True

def sync_account(account):
    print("🔄 Syncing account...")
    try:
        balance = account.sync()
        print(f"Account synced. Available Balance: {balance.baseCoin.available} TST")
    except Exception as e:
        print(f"Error syncing account: {e}")

def send_sensor_data(account, did: str, sensor_data: dict):
    try:
        # Validate that we have at least a JSON object
        validate_sensor_data(sensor_data)
        
        # Convert sensor data to JSON string
        payload_str = json.dumps(sensor_data)
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Sending sensor data for DID: {did}")
        
        # Create a short tag from the DID and encode as hex (with a "0x" prefix)
        short_tag = hashlib.blake2b(did.encode("utf-8"), digest_size=16).digest().hex()
        tag_hex = "0x" + short_tag
        
        # Encode the sensor data to hex (with "0x" prefix)
        data_hex = "0x" + payload_str.encode("utf-8").hex()
        
        # Create a TaggedDataPayload with hex strings
        tagged_data = TaggedDataPayload(tag=tag_hex, data=data_hex)
        tx_options = TransactionOptions(tagged_data_payload=tagged_data)
        
        # Send the transaction with the required minimum deposit (50600 base units)
        transaction = account.send(
            address=account.addresses()[0].address,  # Sending to self
            amount=50600,
            options=tx_options
        )
        
        block_id = transaction.blockId  
        print(f"Sensor data transfer sent! Block ID: {block_id}")
        return block_id
    
    except Exception as e:
        print(f"Error sending sensor data: {e}")
        return None

def main():
    if not STRONGHOLD_PASSWORD:
        print("STRONGHOLD_PASSWORD environment variable is not set.")
        return
    
    account = get_or_create_account(ACCOUNT_ALIAS)
    sync_account(account)
    address = account.addresses()[0].address
    device_did = f"did:iota:{address}"  
    print(f"Device DID: {device_did}")
    
    if len(sys.argv) > 1:
        try:
            # Load sensor data from the command-line argument
            sensor_data = json.loads(sys.argv[1])
            print("Received sensor data from external source.")
        except Exception as e:
            print(f"Failed to parse sensor data from argument: {e}")
            sys.exit(1)
    else:
        # Simulate sensor data if no argument is provided.
        sensor_data = {
            "temperature": 18.0,
            "Pressure": 1013,
            "location": "Lat: 40.4168, Long: -3.7038",
            "timestamp": int(time.time())
        }
        print("No external sensor data provided; using simulated data.")
    
    block_id = send_sensor_data(account, device_did, sensor_data)
    if block_id:
        print("Sensor data transfer successfully published!")
    else:
        print("Failed to publish sensor data transfer.")

if __name__ == "__main__":
    main()