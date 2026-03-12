import { getDiscoveryTargets } from './discover-devices';
import { Settings } from '../../services';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
    return {
        checkDevicesInterval: 5000,
        discoverDevicesInterval: 60000,
        checkAccountInterval: 5000,
        credentialStoragePath: '/tmp/creds.json',
        allowPs4Devices: false,
        deviceDiscoveryBroadcastAddress: undefined,
        deviceDiscoveryBroadcastAddresses: [],
        deviceHosts: [],
        discoveryTopic: 'homeassistant',
        ...overrides,
    };
}

describe("getDiscoveryTargets", () => {
    test("returns empty array when no targets configured", () => {
        const settings = makeSettings();
        expect(getDiscoveryTargets(settings)).toEqual([]);
    });

    test("returns legacy broadcast address", () => {
        const settings = makeSettings({
            deviceDiscoveryBroadcastAddress: '192.168.1.255',
        });
        expect(getDiscoveryTargets(settings)).toEqual(['192.168.1.255']);
    });

    test("returns multiple broadcast addresses", () => {
        const settings = makeSettings({
            deviceDiscoveryBroadcastAddresses: ['192.168.1.255', '192.168.20.255'],
        });
        expect(getDiscoveryTargets(settings)).toEqual(['192.168.1.255', '192.168.20.255']);
    });

    test("returns device host IPs", () => {
        const settings = makeSettings({
            deviceHosts: [
                { host: '192.168.1.35', name: 'Living Room PS5' },
                { host: '192.168.1.36' },
            ],
        });
        expect(getDiscoveryTargets(settings)).toEqual(['192.168.1.35', '192.168.1.36']);
    });

    test("merges all sources and deduplicates", () => {
        const settings = makeSettings({
            deviceDiscoveryBroadcastAddress: '192.168.1.255',
            deviceDiscoveryBroadcastAddresses: ['192.168.1.255', '192.168.20.255'],
            deviceHosts: [
                { host: '192.168.1.35' },
                { host: '192.168.20.255' }, // duplicate of broadcast address
            ],
        });
        expect(getDiscoveryTargets(settings)).toEqual([
            '192.168.1.255',
            '192.168.20.255',
            '192.168.1.35',
        ]);
    });

    test("legacy address is included first, followed by array addresses and host IPs", () => {
        const settings = makeSettings({
            deviceDiscoveryBroadcastAddress: '10.0.0.255',
            deviceDiscoveryBroadcastAddresses: ['192.168.1.255'],
            deviceHosts: [{ host: '192.168.1.35' }],
        });
        const targets = getDiscoveryTargets(settings);
        expect(targets[0]).toBe('10.0.0.255');
        expect(targets[1]).toBe('192.168.1.255');
        expect(targets[2]).toBe('192.168.1.35');
    });

    test("skips empty/falsy entries", () => {
        const settings = makeSettings({
            deviceDiscoveryBroadcastAddresses: ['', '192.168.1.255', ''],
            deviceHosts: [{ host: '' }, { host: '192.168.1.35' }],
        });
        expect(getDiscoveryTargets(settings)).toEqual(['192.168.1.255', '192.168.1.35']);
    });
});
