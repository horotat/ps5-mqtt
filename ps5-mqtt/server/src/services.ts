export const MQTT_CLIENT = 'MQTT';
export const SETTINGS = 'SETTINGS';

export interface DeviceHostInfo {
    host: string;
    name?: string;
}

export interface Settings {
    // polling intervals
    checkDevicesInterval: number;
    discoverDevicesInterval: number;
    checkAccountInterval: number;

    credentialStoragePath: string;
    allowPs4Devices: boolean;

    deviceDiscoveryBroadcastAddress: string;
    deviceDiscoveryBroadcastAddresses: string[];
    deviceHosts: DeviceHostInfo[];

    discoveryTopic: string;
}