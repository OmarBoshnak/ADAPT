/// <reference types="node" />
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { networkInterfaces } from 'node:os';

// The relay runs on the development machine, so its LAN address is known when the app is built.
function lanAddress(): string {
  for (const nets of Object.values(networkInterfaces())) {
    const net = nets?.find((n) => n.family === 'IPv4' && !n.internal);
    if (net) return net.address;
  }
  return '127.0.0.1';
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    relayUrl: process.env.ADAPT_RELAY_URL ?? `ws://${lanAddress()}:8787/ws`,
  },
});
