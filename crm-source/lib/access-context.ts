import { AsyncLocalStorage } from 'node:async_hooks';
import type { Identity } from './access';
const identities = new AsyncLocalStorage<Identity>();
export const runWithIdentity = <T>(identity: Identity, run: () => T): T => identities.run(identity, run);
export const getIdentity = (): Identity | undefined => identities.getStore();
