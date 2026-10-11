import Constants from 'expo-constants';

export const relayUrl: string =
  (Constants.expoConfig?.extra?.relayUrl as string | undefined) ?? 'ws://192.168.1.5:8787/ws';

export const relayHost = relayUrl.replace(/^wss?:\/\//, '').replace(/[:/].*$/, '');

export const relayHttpUrl = relayUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
