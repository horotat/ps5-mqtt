import bodyParser from 'body-parser';
import createDebugger from 'debug';
import express, { Express } from 'express';
import path from 'path';

import { Discovery } from "playactor/dist/discovery";
import { DeviceType, IDiscoveredDevice } from "playactor/dist/discovery/model";
import { IInputOutput } from 'playactor/dist/cli/io';
import { CredentialManager } from 'playactor/dist/credentials';
import { DiskCredentialsStorage } from 'playactor/dist/credentials/disk-storage';
import { OauthCredentialRequester } from 'playactor/dist/credentials/oauth/requester';
import { WriteOnlyStorage } from 'playactor/dist/credentials/write-only-storage';

import { Settings } from './services';
import { createErrorLogger } from './util/error-logger';

const debug = createDebugger("@ha:ps5:webserver");
const debugPa = createDebugger("@ha:ps5:webserver:playactor");
const logError = createErrorLogger();

let app: Express | undefined = undefined;

/**
 * Build the list of discovery target addresses from settings.
 * Merges legacy single address, multiple addresses, and device host IPs.
 */
function getWebDiscoveryTargets(settings: Settings): string[] {
    const targets: string[] = [];

    if (settings.deviceDiscoveryBroadcastAddress) {
        targets.push(settings.deviceDiscoveryBroadcastAddress);
    }

    for (const addr of settings.deviceDiscoveryBroadcastAddresses) {
        if (addr && !targets.includes(addr)) {
            targets.push(addr);
        }
    }

    for (const deviceHost of settings.deviceHosts) {
        if (deviceHost.host && !targets.includes(deviceHost.host)) {
            targets.push(deviceHost.host);
        }
    }

    return targets;
}

/**
 * Discover devices against a single target IP (broadcast or unicast).
 */
async function discoverFromTarget(
    target: string | undefined,
    allowPs4Devices: boolean,
    timeoutMillis = 5000
): Promise<IDiscoveredDevice[]> {
    const discoveryOpts = target ? { timeoutMillis, deviceIp: target } : { timeoutMillis };
    const discovery = new Discovery(discoveryOpts);
    const devices: IDiscoveredDevice[] = [];

    for await (const device of discovery.discover()) {
        if (allowPs4Devices || device.type !== DeviceType.PS4) {
            devices.push(device);
        }
    }

    return devices;
}

export function setupWebserver(
    port: number | string,
    settings: Settings
): Express {
    const {
        allowPs4Devices,
        credentialStoragePath,
    } = settings;

    if (app !== undefined) {
        throw Error('web server is already running');
    }

    app = express();

    // host client files
    app.use('/', express.static(path.join(__dirname, '..', '..', 'client')));
    app.use(bodyParser.json());

    app.get('/api/discover', async (req, res) => {
        try {
            const targets = getWebDiscoveryTargets(settings);
            const allDevices: IDiscoveredDevice[] = [];
            const seenIds = new Set<string>();

            if (targets.length === 0) {
                // Default broadcast (no specific target)
                debug("Web discovery: using default broadcast");
                const devices = await discoverFromTarget(undefined, allowPs4Devices);
                for (const device of devices) {
                    if (!seenIds.has(device.id)) {
                        seenIds.add(device.id);
                        allDevices.push(device);
                    }
                }
            } else {
                for (const target of targets) {
                    try {
                        debug("Web discovery: trying target %s", target);
                        const devices = await discoverFromTarget(target, allowPs4Devices);
                        for (const device of devices) {
                            if (!seenIds.has(device.id)) {
                                seenIds.add(device.id);
                                allDevices.push(device);
                            }
                        }
                    } catch (e) {
                        debug("Web discovery: no response from target %s", target);
                    }
                }
            }

            res.send({ devices: allDevices });
        } catch (e) {
            logError(e);
            res.status(500).send();
        }
    });

    app.post('/api/discover-host', async (req, res) => {
        try {
            const { host } = req.body as { host: string };
            if (!host) {
                res.status(400).send('host is required');
                return;
            }

            debug("Manual host discovery: trying %s", host);
            const devices = await discoverFromTarget(host, allowPs4Devices, 8000);

            if (devices.length === 0) {
                debug("Manual host discovery: no device found at %s", host);
                res.send({ devices: [] });
            } else {
                debug("Manual host discovery: found %d device(s) at %s", devices.length, host);
                res.send({ devices });
            }
        } catch (e) {
            debug("Manual host discovery failed for requested host: %s", e);
            res.send({ devices: [] });
        }
    });

    app.post('/api/acquire-authentication-link', async (req, res) => {
        let success = false;
        try {
            const { device } = req.body as { device: IDiscoveredDevice }
            debug(`connecting to device: '${device.id}'`);

            await handleDeviceAuthentication(
                device,
                credentialStoragePath,
                {
                    onPerformLogin: async (url) => {
                        success = true;
                        res.status(200).send(url);
                        return undefined as unknown as string;
                    },
                    onPrompt: async (pt) => {
                        debugPa(pt);
                        return '';
                    },
                }
            );
        } catch (e) {
            if (!success) {
                logError(e);
                res.status(500).send(e?.toString());
            }
        }
    });

    app.post('/api/connect', async (req, res) => {
        try {
            const { device, url, pin } = req.body as { device: IDiscoveredDevice, url: string, pin: string }
            debug(`connecting to device: '${device.id}'`);

            await handleDeviceAuthentication(
                device,
                credentialStoragePath,
                {
                    onPerformLogin: async () => {
                        return url;
                    },
                    onPrompt: async (pt) => {
                        debugPa(pt);
                        return pin;
                    },
                }
            );

            res.status(201).send();
        } catch (e) {
            logError(e);
            res.status(500).send(e?.toString());
        }
    });

    app.listen(port, () => {
        debug("Server listening on PORT:", port);
    });

    return app;
}

async function handleDeviceAuthentication(device: IDiscoveredDevice, credentialStoragePath: string, handlers: {
    onPerformLogin: (url: string) => Promise<string>,
    onPrompt: (promptText: string) => Promise<string>
}): Promise<void> {
    const x: IInputOutput = {
        logError: (e) => {
            logError(e);
        },
        logInfo: (m) => {
            debugPa(m);
        },
        logResult: (r) => {
            debugPa(r);
        },

        prompt: handlers.onPrompt
    };

    const credentialRequester = new OauthCredentialRequester(x, {
        performLogin: handlers.onPerformLogin
    });

    const cm = new CredentialManager(
        credentialRequester,
        new WriteOnlyStorage(
            new DiskCredentialsStorage(credentialStoragePath)
        )
    );

    const fd = await cm.getForDevice(device);

    debugPa(fd);
}

