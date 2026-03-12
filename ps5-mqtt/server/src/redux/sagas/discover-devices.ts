import createDebugger from "debug";
import { Discovery } from "playactor/dist/discovery";
import { DeviceType } from "playactor/dist/discovery/model";
import { call, getContext, put, select } from "redux-saga/effects";
import { SETTINGS, Settings } from "../../services";
import { createErrorLogger } from "../../util/error-logger";
import { registerDevice } from "../action-creators";
import { getDeviceRegistry } from "../selectors";
import { Device } from "../types";

const debug = createDebugger("@ha:ps5:discovery");
const logError = createErrorLogger();

const useAsyncIterableWithSaga =
    (fn: (...args: unknown[]) => AsyncIterable<unknown>, ...args) =>
        () =>
            // eslint-disable-next-line no-async-promise-executor
            new Promise(async (resolve, reject) => {
                const iterable = fn(...args);
                const outputs: unknown[] = [];
                try {
                    for await (const iterableAction of await iterable) {
                        if (iterableAction) {
                            outputs.push(iterableAction);
                        }
                    }
                    resolve(outputs);
                } catch (error) {
                    reject(error);
                }
            });

/**
 * Build a deduplicated list of all discovery targets (broadcast addresses + direct host IPs).
 */
function getDiscoveryTargets(settings: Settings): string[] {
    const targets: string[] = [];

    // Legacy single broadcast address
    if (settings.deviceDiscoveryBroadcastAddress) {
        targets.push(settings.deviceDiscoveryBroadcastAddress);
    }

    // Multiple broadcast addresses
    for (const addr of settings.deviceDiscoveryBroadcastAddresses) {
        if (addr && !targets.includes(addr)) {
            targets.push(addr);
        }
    }

    // Direct device host IPs (unicast)
    for (const deviceHost of settings.deviceHosts) {
        if (deviceHost.host && !targets.includes(deviceHost.host)) {
            targets.push(deviceHost.host);
        }
    }

    return targets;
}

function* discoverDevices() {
    const settings: Settings = yield getContext(SETTINGS);
    const { allowPs4Devices } = settings;

    const targets = getDiscoveryTargets(settings);

    if (targets.length === 0) {
        debug("No specific discovery targets configured; using default broadcast discovery");
    } else {
        debug("Discovery targets: %o", targets);
    }

    const allDiscoveredDevices: Device[] = [];
    const seenDeviceIds = new Set<string>();

    if (targets.length === 0) {
        // Default broadcast discovery (no specific address)
        try {
            debug("Using default broadcast discovery");
            const discovery = new Discovery();
            const devices: Device[] = yield call(
                useAsyncIterableWithSaga(
                    discovery.discover.bind(discovery),
                    {},
                    { timeoutMillis: 3000 }
                )
            );
            for (const device of devices) {
                if (!seenDeviceIds.has(device.id)) {
                    seenDeviceIds.add(device.id);
                    allDiscoveredDevices.push(device);
                }
            }
        } catch (e) {
            logError(e);
            debug("Default broadcast discovery failed");
        }
    } else {
        // Discover against each target
        for (const target of targets) {
            try {
                debug("Trying discovery target: %s", target);
                const discovery = new Discovery({
                    deviceIp: target
                });
                const devices: Device[] = yield call(
                    useAsyncIterableWithSaga(
                        discovery.discover.bind(discovery),
                        {},
                        { timeoutMillis: 3000 }
                    )
                );
                for (const device of devices) {
                    if (!seenDeviceIds.has(device.id)) {
                        seenDeviceIds.add(device.id);
                        allDiscoveredDevices.push(device);
                        debug("Discovered device '%s' (%s) at %s via target %s",
                            device.name, device.id, device.address?.address, target);
                    }
                }
            } catch (e) {
                logError(e);
                debug("No discovery response from target %s. " +
                    "If this is a cross-VLAN target, ensure UDP traffic is allowed and the device is reachable.",
                    target);
            }
        }
    }

    let filteredDevices = allDiscoveredDevices;
    if (!allowPs4Devices) {
        filteredDevices = allDiscoveredDevices.filter(d => d.type === DeviceType.PS5);
    }

    if (filteredDevices.length === 0) {
        debug("No devices discovered. If devices are on another VLAN/subnet, " +
            "consider configuring 'device_hosts' with direct IPs or " +
            "'device_discovery_broadcast_addresses' with the remote subnet broadcast addresses.");
    }

    const trackedDevices = yield select(getDeviceRegistry);
    for (const device of filteredDevices) {
        if (trackedDevices[device.id] === undefined) {
            yield put(
                registerDevice({
                    ...device,
                    available: true,
                    normalizedName:
                        device.name.replace(/[^a-zA-Z\d\s-_:]/g, '')
                            .replace(/[\s-]/g, '_')
                            .toLowerCase(),
                    activity: undefined,
                })
            );
        }
    }
}

export { discoverDevices, getDiscoveryTargets };

