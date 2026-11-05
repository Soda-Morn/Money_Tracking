import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
} from 'firebase/firestore'
import { app } from './firebase'

// On-device cache (IndexedDB, free on the Spark plan): the last-known data is
// shown instantly on the next visit and live updates arrive right after, which
// also makes the PWA genuinely work offline. Logging out wipes this cache
// (see useAuth.logout). Falls back to memory-only if IndexedDB is unavailable
// (e.g. some private-browsing modes).
let localCache
try {
  localCache = persistentLocalCache({ tabManager: persistentMultipleTabManager() })
} catch {
  localCache = memoryLocalCache()
}

export const db = initializeFirestore(app, { localCache })
