import * as Grommet from "grommet";
import * as GrommetIcons from 'grommet-icons';
import React from "react";
import { Loader } from "./app";
import { AppContext } from "./context";
import { Device } from "./device";
import type { IDevice } from "./types";

const ManualHostForm: React.FC<{
    onDevicesFound: (devices: IDevice[]) => void;
}> = ({ onDevicesFound }) => {
    const { api } = React.useContext(AppContext);
    const [host, setHost] = React.useState<string>("");
    const [searching, setSearching] = React.useState<boolean>(false);
    const [message, setMessage] = React.useState<string>("");

    const handleSubmit = async () => {
        if (!host.trim()) return;
        setSearching(true);
        setMessage("");
        const devices = await api.discoverByHost(host.trim());
        setSearching(false);
        if (devices && devices.length > 0) {
            setMessage(`Found ${devices.length} device(s) at ${host}`);
            onDevicesFound(devices);
        } else {
            setMessage(`No device found at ${host}. Ensure the device is on and reachable.`);
        }
    };

    return (
        <Grommet.Box gap="small" pad="small" border round="small">
            <Grommet.Heading level="4" margin="none">Add Device by IP</Grommet.Heading>
            <Grommet.Text size="small" color="dark-4">
                Enter the IP address of a PlayStation device on another subnet/VLAN.
            </Grommet.Text>
            <Grommet.Box direction="row" gap="small" align="center">
                <Grommet.TextInput
                    placeholder="e.g. 192.168.1.35"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    disabled={searching}
                    icon={<GrommetIcons.Search />}
                />
                <Grommet.Button
                    primary
                    label={searching ? "Searching..." : "Discover"}
                    onClick={handleSubmit}
                    disabled={searching || !host.trim()}
                    icon={searching ? <Grommet.Spinner /> : undefined}
                />
            </Grommet.Box>
            {message && (
                <Grommet.Text size="small" color={message.startsWith("No") ? "status-warning" : "status-ok"}>
                    {message}
                </Grommet.Text>
            )}
        </Grommet.Box>
    );
};

export const Devices: React.FC = () => {
    const { api } = React.useContext(AppContext);
    const [devices, setDevices] = React.useState<IDevice[] | undefined>();
    const [isDiscovering, setIsDiscovering] = React.useState<boolean>(false);

    React.useEffect(() => {
        setIsDiscovering(false);
    }, [devices]);

    React.useEffect(() => {
        setIsDiscovering(true);
        api.getDevices().then(d => setDevices(d));
    }, []);

    const handleManualDevicesFound = (newDevices: IDevice[]) => {
        setDevices((prev) => {
            const existing = prev ?? [];
            const seenIds = new Set(existing.map(d => d.id));
            const unique = newDevices.filter(d => !seenIds.has(d.id));
            return [...existing, ...unique];
        });
    };

    return (
        <Grommet.Box align='center' gap="medium" pad="medium">
            <Grommet.Box align="start" pad="large" gap="large">
                {
                    isDiscovering
                        ? <Loader />
                        : (
                            <Grommet.Button size="large" primary disabled={isDiscovering} onClick={async () => {
                                setIsDiscovering(true);
                                const devices = await api.getDevices();
                                setDevices(devices);
                            }} label="Refresh Devices" />
                        )
                }
            </Grommet.Box>

            <ManualHostForm onDevicesFound={handleManualDevicesFound} />

            {!isDiscovering && devices?.map(d => (
                <Device device={d} key={d.id} />
            ))}
        </Grommet.Box>
    );
}