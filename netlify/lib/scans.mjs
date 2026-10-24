import { getStore } from '@netlify/blobs';

// One blob per scan step, keyed day/slug/event/device/visitor/unique, so writes
// never collide and the dashboard can count by listing keys. Production and
// deploy-preview traffic go to separate stores so testing doesn't skew the numbers.
export function scansStore(context, test) {
  const live = test === undefined ? context.deploy?.context === 'production' : !test;
  return getStore({ name: live ? 'scans-live' : 'scans-test', consistency: 'strong' });
}

export const TIME_ZONE = 'America/New_York';
export const EVENTS = ['scan', 'start', 'found', 'save', 'link'];
