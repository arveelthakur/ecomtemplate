import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Isolate the browser client import so the real document adapter can run
// against an offline transport without Vite environment variables or credentials.
const source = await readFile(new URL('../src/lib/supabase/documents.ts', import.meta.url), 'utf8');
const isolated = source.replace(
  "import { requireSupabase } from './client';",
  'let client; export const setTestClient = value => { client = value; }; const requireSupabase = () => client;',
);
assert.notEqual(isolated, source);
const javascript = ts.transpileModule(isolated, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const adapter = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

function transport({ payload = null, rows = [], error = null, subscriptionStatuses = [] } = {}) {
  const channel = {
    on() { return this; },
    subscribe(onStatus) {
      for (const status of subscriptionStatuses) queueMicrotask(() => onStatus(status));
      return this;
    },
  };
  return {
    removed: 0,
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async limit() { return { data: rows, error }; },
        async maybeSingle() { return { data: payload === null ? null : { payload }, error }; },
      };
    },
    channel() { return channel; },
    async removeChannel() { this.removed += 1; },
  };
}

test('collection references create unique document IDs and accept explicit IDs', () => {
  const collection = adapter.collection(null, 'emailCampaignDrafts');
  const first = adapter.doc(collection);
  const second = adapter.doc(collection);
  assert.equal(first.collectionPath, 'emailCampaignDrafts');
  assert.ok(first.id);
  assert.notEqual(first.id, second.id);
  assert.equal(adapter.doc(collection, 'draft-one').path, 'emailCampaignDrafts/draft-one');
  assert.equal(adapter.doc(null, 'users', 'customer-one').path, 'users/customer-one');
});

test('document snapshots expose server metadata and clone their payload', async () => {
  adapter.setTestClient(transport({ payload: { settings: { title: 'Store' } } }));
  const snapshot = await adapter.getDoc(adapter.doc(null, 'storeContent', 'global'));
  assert.equal(snapshot.exists(), true);
  assert.deepEqual(snapshot.metadata, { fromCache: false, hasPendingWrites: false });
  snapshot.data().settings.title = 'Changed locally';
  assert.equal(snapshot.data().settings.title, 'Store');

  adapter.setTestClient(transport());
  const missing = await adapter.getDoc(adapter.doc(null, 'storeContent', 'missing'));
  assert.equal(missing.exists(), false);
  assert.equal(missing.data(), undefined);
});

test('collection listeners emit existing query documents and unsubscribe', async () => {
  const client = transport({ rows: [{ path: 'orders/order-one', payload: { status: 'pending' } }] });
  adapter.setTestClient(client);
  let stop;
  await new Promise((resolve, reject) => {
    stop = adapter.onSnapshot(adapter.collection(null, 'orders'), snapshot => {
      try {
        assert.equal(snapshot.size, 1);
        assert.equal(snapshot.docs[0].exists(), true);
        assert.equal(snapshot.docs[0].data().status, 'pending');
        assert.equal(snapshot.docs[0].metadata.fromCache, false);
        resolve();
      } catch (error) { reject(error); }
    }, reject);
  });
  stop();
  assert.equal(client.removed, 1);
});

test('listener transport failures are normalized to Error objects', async () => {
  adapter.setTestClient(transport({ error: 'read denied' }));
  let stop;
  await new Promise((resolve, reject) => {
    stop = adapter.onSnapshot(adapter.doc(null, 'orders', 'order-one'), () => {
      reject(new Error('A failed read must not emit a snapshot.'));
    }, error => {
      try {
        assert.ok(error instanceof Error);
        assert.match(error.message, /read denied/);
        resolve();
      } catch (failure) { reject(failure); }
    });
  });
  stop();
});

test('realtime channel errors fall back to polling without becoming listener errors', async () => {
  const client = transport({ subscriptionStatuses: ['CHANNEL_ERROR'] });
  adapter.setTestClient(client);
  const listenerErrors = [];
  const stop = adapter.onSnapshot(
    adapter.collection(null, 'storeContent'),
    () => {},
    error => listenerErrors.push(error),
  );

  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(listenerErrors, []);
  stop();
  assert.equal(client.removed, 1);
});
