import fs from 'fs';

import { AppConfig, getAppConfig } from './config';

jest.mock('fs');

const mockedReadFileSync = (fs as jest.Mocked<typeof fs>).readFileSync;
const mockedExistsSync = (fs as jest.Mocked<typeof fs>).existsSync;

describe("Configuration", () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Clear relevant env vars
        delete process.env['INCLUDE_PS4_DEVICES'];
        delete process.env['DEVICE_DISCOVERY_BROADCAST_ADDRESSES'];
        delete process.env['DEVICE_HOSTS'];
    });

    test("correctly parses configuration file when no environment variables are specified", () => {
        process.env['CONFIG_PATH'] = "./dummy-file-path";

        mockedExistsSync.mockReturnValue(true);
        mockedReadFileSync.mockReturnValue(JSON.stringify(<AppConfig>{
            mqtt: {
                host: 'core-mosquitto',
                port: '1883',
                pass: 'REDACTED',
                user: 'addons',
                discovery_topic: 'homeassistant'
            },
            logger: '@ha:ps5:*,@ha:ps5-sensitive:*',
            device_check_interval: 5000,
            device_discovery_interval: 60000,
            account_check_interval: 5000,
            include_ps4_devices: true,
            device_discovery_broadcast_address: '255.255.255.255',
            device_discovery_broadcast_addresses: [],
            device_hosts: [],
            psn_accounts: [
                {
                    username: 'REDACTED',
                    npsso: 'REDACTED'
                }
            ],
            credentialsStoragePath: '/config/ps5-mqtt/credentials.json',
            frontendPort: '62428'
        }));

        const config = getAppConfig();

        expect(config).toEqual(<AppConfig>{
            mqtt: {
                host: 'core-mosquitto',
                port: '1883',
                pass: 'REDACTED',
                user: 'addons',
                discovery_topic: 'homeassistant'
            },
            logger: '@ha:ps5:*,@ha:ps5-sensitive:*',
            device_check_interval: 5000,
            device_discovery_interval: 60000,
            account_check_interval: 5000,
            include_ps4_devices: true,
            device_discovery_broadcast_address: '255.255.255.255',
            device_discovery_broadcast_addresses: [],
            device_hosts: [],
            psn_accounts: [
                {
                    username: 'REDACTED',
                    npsso: 'REDACTED'
                }
            ],
            credentialsStoragePath: '/config/ps5-mqtt/credentials.json',
            frontendPort: '62428'
        });
    });

    test("correctly merges environment variables and configuration file", () => {
        process.env['CONFIG_PATH'] = "./dummy-file-path";
        process.env['INCLUDE_PS4_DEVICES'] = "false"

        mockedExistsSync.mockReturnValue(true);
        mockedReadFileSync.mockReturnValue(JSON.stringify(<Partial<AppConfig>>{
            mqtt: {
                host: 'core-mosquitto',
                port: '1883',
                pass: 'REDACTED',
                user: 'addons',
                discovery_topic: 'homeassistant'
            },
            logger: '@ha:ps5:*,@ha:ps5-sensitive:*',
            device_check_interval: 5000,
            device_discovery_interval: 60000,
            account_check_interval: 5000,
            psn_accounts: [
                {
                    username: 'REDACTED',
                    npsso: 'REDACTED'
                }
            ],
            credentialsStoragePath: '/config/ps5-mqtt/credentials.json',
            frontendPort: '62428'
        }));

        const config = getAppConfig();

        expect(config).toEqual(<AppConfig>{
            mqtt: {
                host: 'core-mosquitto',
                port: '1883',
                pass: 'REDACTED',
                user: 'addons',
                discovery_topic: 'homeassistant'
            },
            logger: '@ha:ps5:*,@ha:ps5-sensitive:*',
            device_check_interval: 5000,
            device_discovery_interval: 60000,
            account_check_interval: 5000,
            include_ps4_devices: false,
            device_discovery_broadcast_address: undefined,
            device_discovery_broadcast_addresses: undefined,
            device_hosts: undefined,
            psn_accounts: [
                {
                    username: 'REDACTED',
                    npsso: 'REDACTED'
                }
            ],
            credentialsStoragePath: '/config/ps5-mqtt/credentials.json',
            frontendPort: '62428'
        });
    });

    test("correctly parses multiple broadcast addresses from environment", () => {
        process.env['CONFIG_PATH'] = "./dummy-file-path";
        process.env['DEVICE_DISCOVERY_BROADCAST_ADDRESSES'] = '["192.168.1.255","192.168.20.255"]';

        mockedExistsSync.mockReturnValue(true);
        mockedReadFileSync.mockReturnValue(JSON.stringify(<Partial<AppConfig>>{
            mqtt: {
                host: 'core-mosquitto',
                port: '1883',
                pass: 'REDACTED',
                user: 'addons',
                discovery_topic: 'homeassistant'
            },
            device_check_interval: 5000,
            device_discovery_interval: 60000,
            account_check_interval: 5000,
            credentialsStoragePath: '/config/ps5-mqtt/credentials.json',
            frontendPort: '62428'
        }));

        const config = getAppConfig();

        expect(config.device_discovery_broadcast_addresses).toEqual([
            '192.168.1.255',
            '192.168.20.255'
        ]);
    });

    test("correctly parses device_hosts from environment", () => {
        process.env['CONFIG_PATH'] = "./dummy-file-path";
        process.env['DEVICE_HOSTS'] = '[{"host":"192.168.1.35","name":"Living Room PS5"}]';

        mockedExistsSync.mockReturnValue(true);
        mockedReadFileSync.mockReturnValue(JSON.stringify(<Partial<AppConfig>>{
            mqtt: {
                host: 'core-mosquitto',
                port: '1883',
                pass: 'REDACTED',
                user: 'addons',
                discovery_topic: 'homeassistant'
            },
            device_check_interval: 5000,
            device_discovery_interval: 60000,
            account_check_interval: 5000,
            credentialsStoragePath: '/config/ps5-mqtt/credentials.json',
            frontendPort: '62428'
        }));

        const config = getAppConfig();

        expect(config.device_hosts).toEqual([
            { host: '192.168.1.35', name: 'Living Room PS5' }
        ]);
    });

    test("correctly parses device_hosts and broadcast_addresses from JSON config", () => {
        process.env['CONFIG_PATH'] = "./dummy-file-path";

        mockedExistsSync.mockReturnValue(true);
        mockedReadFileSync.mockReturnValue(JSON.stringify(<Partial<AppConfig>>{
            mqtt: {
                host: 'core-mosquitto',
                port: '1883',
                pass: 'REDACTED',
                user: 'addons',
                discovery_topic: 'homeassistant'
            },
            device_check_interval: 5000,
            device_discovery_interval: 60000,
            account_check_interval: 5000,
            device_discovery_broadcast_addresses: ['192.168.1.255', '192.168.20.255'],
            device_hosts: [
                { host: '192.168.1.35', name: 'Living Room PS5' },
                { host: '192.168.1.36' }
            ],
            credentialsStoragePath: '/config/ps5-mqtt/credentials.json',
            frontendPort: '62428'
        }));

        const config = getAppConfig();

        expect(config.device_discovery_broadcast_addresses).toEqual([
            '192.168.1.255',
            '192.168.20.255'
        ]);
        expect(config.device_hosts).toEqual([
            { host: '192.168.1.35', name: 'Living Room PS5' },
            { host: '192.168.1.36' }
        ]);
    });
});
