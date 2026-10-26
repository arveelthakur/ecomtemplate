import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabase } from './client';
import { withSupabaseRequestRetry } from './requestRetry';

type Filter = { kind: 'where'; field: string; operator: string; value: unknown };
type Sort = { kind: 'orderBy'; field: string; direction: 'asc' | 'desc' };
type Cap = { kind: 'limit'; count: number };
type Constraint = Filter | Sort | Cap;

export type StoreDocumentReference = {
  kind: 'document';
  path: string;
  collectionPath: string;
  id: string;
};
export type StoreCollectionReference = { kind: 'collection'; path: string };
export type StoreQuery = {
  kind: 'query';
  path: string;
  constraints: Constraint[];
};
type Source = StoreDocumentReference | StoreCollectionReference | StoreQuery;
type Operation = { type: 'set' | 'update' | 'delete'; path: string; data?: Record<string, unknown>; merge?: boolean };

// Documents are schemaless JSON; consumers normalize collection-specific fields.
// Keep the snapshot itself typed, including existence checks and query documents.
export type StoreDocumentData = Record<string, any>;
export interface StoreDocumentSnapshot {
  id: string;
  ref: StoreDocumentReference;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
  exists(): this is StoreQueryDocumentSnapshot;
  data(): StoreDocumentData | undefined;
}
export interface StoreQueryDocumentSnapshot extends StoreDocumentSnapshot {
  data(): StoreDocumentData;
}
export type StoreQuerySnapshot = {
  docs: StoreQueryDocumentSnapshot[];
  empty: boolean;
  size: number;
  forEach: (callback: (item: StoreQueryDocumentSnapshot) => void) => void;
};

const transformKey = '__storeDocumentTransform';
const transform = (kind: string, values: unknown[] = []) => ({ [transformKey]: kind, values });

export function serverTimestamp() {
  return new Date().toISOString();
}
export function deleteField() {
  return transform('delete');
}
export function arrayUnion(...values: unknown[]) {
  return transform('arrayUnion', values);
}
export function arrayRemove(...values: unknown[]) {
  return transform('arrayRemove', values);
}

function cleanPath(parts: unknown[]) {
  const path = parts
    .flatMap(part => typeof part === 'string' ? part.split('/') : [])
    .map(part => part.trim())
    .filter(Boolean)
    .join('/');
  if (!path || path.includes('..')) throw new Error('Invalid Supabase document path.');
  return path;
}

function toReference(path: string): StoreDocumentReference {
  const separator = path.lastIndexOf('/');
  if (separator <= 0 || separator === path.length - 1) throw new Error('A document path must include a collection and ID.');
  return {
    kind: 'document',
    path,
    collectionPath: path.slice(0, separator),
    id: path.slice(separator + 1),
  };
}

export function collection(_client: SupabaseClient | null, ...parts: unknown[]): StoreCollectionReference {
  return { kind: 'collection', path: cleanPath(parts) };
}

export function doc(_client: SupabaseClient | StoreCollectionReference | null, ...parts: unknown[]): StoreDocumentReference {
  if (_client && 'kind' in _client && _client.kind === 'collection') {
    const id = parts.length ? cleanPath(parts) : globalThis.crypto.randomUUID();
    return toReference(`${_client.path}/${id}`);
  }
  const last = parts.at(-1);
  if (parts.length === 1 && last && typeof last === 'object' && 'kind' in last && last.kind === 'collection') {
    const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return toReference(`${(last as StoreCollectionReference).path}/${randomId}`);
  }
  return toReference(cleanPath(parts));
}

export function where(field: string, operator: string, value: unknown): Filter {
  return { kind: 'where', field, operator, value };
}
export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): Sort {
  return { kind: 'orderBy', field, direction };
}
export function limit(count: number): Cap {
  return { kind: 'limit', count: Math.max(0, Math.min(1000, Math.trunc(count))) };
}
export function query(source: StoreCollectionReference | StoreQuery, ...constraints: Constraint[]): StoreQuery {
  return { kind: 'query', path: source.path, constraints: [...('constraints' in source ? source.constraints : []), ...constraints] };
}

function getValue(row: Record<string, unknown>, field: string): unknown {
  return field.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, row);
}

function matches(value: unknown, operator: string, expected: unknown) {
  switch (operator) {
    case '==': return Object.is(value, expected);
    case '!=': return !Object.is(value, expected);
    case '>': return (value as never) > (expected as never);
    case '>=': return (value as never) >= (expected as never);
    case '<': return (value as never) < (expected as never);
    case '<=': return (value as never) <= (expected as never);
    case 'in': return Array.isArray(expected) && expected.some(item => Object.is(value, item));
    case 'not-in': return Array.isArray(expected) && !expected.some(item => Object.is(value, item));
    case 'array-contains': return Array.isArray(value) && value.some(item => Object.is(item, expected));
    case 'array-contains-any': return Array.isArray(value) && Array.isArray(expected) && value.some(item => expected.some(candidate => Object.is(item, candidate)));
    default: throw new Error(`Unsupported document query operator: ${operator}`);
  }
}

function snapshotFor(path: string, payload: StoreDocumentData): StoreQueryDocumentSnapshot;
function snapshotFor(path: string, payload: StoreDocumentData | null): StoreDocumentSnapshot;
function snapshotFor(path: string, payload: StoreDocumentData | null): StoreDocumentSnapshot {
  const ref = toReference(path);
  return {
    id: ref.id,
    ref,
    metadata: { fromCache: false, hasPendingWrites: false },
    exists(): this is StoreQueryDocumentSnapshot { return payload !== null; },
    data: () => payload ? structuredClone(payload) : undefined,
  };
}

function querySnapshot(rows: Array<{ path: string; payload: Record<string, unknown> }>): StoreQuerySnapshot {
  const docs = rows.map(row => snapshotFor(row.path, row.payload));
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (callback: (item: StoreQueryDocumentSnapshot) => void) => docs.forEach(callback) };
}

async function readDocument(reference: StoreDocumentReference) {
  const client = requireSupabase();
  const { data } = await withSupabaseRequestRetry(
    () => client
      .from('store_documents')
      .select('payload')
      .eq('path', reference.path)
      .maybeSingle(),
    {
      refreshSession: async () => {
        const { error } = await client.auth.refreshSession();
        if (error) throw error;
      },
    },
  );
  return data?.payload && typeof data.payload === 'object' ? data.payload as Record<string, unknown> : null;
}

async function readCollection(source: StoreCollectionReference | StoreQuery) {
  const client = requireSupabase();
  const constraints = 'constraints' in source ? source.constraints : [];
  const { data } = await withSupabaseRequestRetry(
    () => client
      .from('store_documents')
      .select('path,payload')
      .eq('collection_path', source.path)
      .limit(1000),
    {
      refreshSession: async () => {
        const { error } = await client.auth.refreshSession();
        if (error) throw error;
      },
    },
  );
  let rows = (data || []).map(row => ({
    path: String(row.path),
    payload: row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : {},
  }));

  for (const filter of constraints.filter((item): item is Filter => item.kind === 'where')) {
    rows = rows.filter(row => matches(getValue(row.payload, filter.field), filter.operator, filter.value));
  }
  for (const sort of constraints.filter((item): item is Sort => item.kind === 'orderBy')) {
    rows.sort((left, right) => {
      const a = getValue(left.payload, sort.field);
      const b = getValue(right.payload, sort.field);
      const result = a === b ? 0 : a === undefined || a === null ? -1 : b === undefined || b === null ? 1 : a < b ? -1 : 1;
      return sort.direction === 'desc' ? -result : result;
    });
  }
  const max = constraints.find((item): item is Cap => item.kind === 'limit')?.count;
  if (max !== undefined) rows = rows.slice(0, max);
  return rows;
}

export async function getDoc(reference: StoreDocumentReference) {
  return snapshotFor(reference.path, await readDocument(reference));
}
export const getDocFromServer = getDoc;

export async function getDocs(source: StoreCollectionReference | StoreQuery) {
  return querySnapshot(await readCollection(source));
}
export const getDocsFromServer = getDocs;

function resolveTransforms(value: unknown, previous: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => resolveTransforms(item, undefined));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (transformKey in record) {
    const values = Array.isArray(record.values) ? record.values : [];
    switch (record[transformKey]) {
      case 'delete': return undefined;
      case 'arrayUnion': return [...new Map([...(Array.isArray(previous) ? previous : []), ...values].map(item => [JSON.stringify(item), item])).values()];
      case 'arrayRemove': {
        const removed = new Set(values.map(item => JSON.stringify(item)));
        return (Array.isArray(previous) ? previous : []).filter(item => !removed.has(JSON.stringify(item)));
      }
      default: throw new Error('Unsupported document transform.');
    }
  }
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    const next = resolveTransforms(child, (previous as Record<string, unknown> | undefined)?.[key]);
    if (next !== undefined) output[key] = next;
  }
  return output;
}

function mergePayload(previous: Record<string, unknown>, next: Record<string, unknown>) {
  const resolved = resolveTransforms(next, previous) as Record<string, unknown>;
  return { ...previous, ...resolved };
}

export async function setDoc(reference: StoreDocumentReference, payload: Record<string, unknown>, options?: { merge?: boolean }) {
  const old = options?.merge ? await readDocument(reference) : null;
  const next = options?.merge && old ? mergePayload(old, payload) : resolveTransforms(payload, old) as Record<string, unknown>;
  await applyBatch([{ type: 'set', path: reference.path, data: next, merge: false }]);
}

export async function updateDoc(reference: StoreDocumentReference, payload: Record<string, unknown>) {
  const old = await readDocument(reference);
  if (!old) throw new Error(`Document does not exist: ${reference.path}`);
  await applyBatch([{ type: 'update', path: reference.path, data: mergePayload(old, payload) }]);
}

export async function deleteDoc(reference: StoreDocumentReference) {
  await applyBatch([{ type: 'delete', path: reference.path }]);
}

async function applyBatch(operations: Operation[]) {
  const client = requireSupabase();
  await withSupabaseRequestRetry(
    () => client.rpc('apply_store_documents_batch', { p_operations: operations }),
    {
      refreshSession: async () => {
        const { error } = await client.auth.refreshSession();
        if (error) throw error;
      },
    },
  );
}

export function writeBatch(_client: SupabaseClient | null) {
  const operations: Operation[] = [];
  return {
    set(reference: StoreDocumentReference, payload: Record<string, unknown>, options?: { merge?: boolean }) {
      operations.push({ type: 'set', path: reference.path, data: resolveTransforms(payload, undefined) as Record<string, unknown>, merge: options?.merge === true });
    },
    update(reference: StoreDocumentReference, payload: Record<string, unknown>) {
      operations.push({ type: 'update', path: reference.path, data: payload });
    },
    delete(reference: StoreDocumentReference) {
      operations.push({ type: 'delete', path: reference.path });
    },
    commit() {
      return applyBatch(operations);
    },
  };
}

export async function runTransaction<T>(
  _client: SupabaseClient | null,
  callback: (transaction: {
    get: (reference: StoreDocumentReference) => Promise<ReturnType<typeof snapshotFor>>;
    set: (reference: StoreDocumentReference, payload: Record<string, unknown>, options?: { merge?: boolean }) => void;
    update: (reference: StoreDocumentReference, payload: Record<string, unknown>) => void;
    delete: (reference: StoreDocumentReference) => void;
  }) => Promise<T>,
): Promise<T> {
  const operations: Operation[] = [];
  const transaction = {
    get: async (reference: StoreDocumentReference) => snapshotFor(reference.path, await readDocument(reference)),
    set: (reference: StoreDocumentReference, payload: Record<string, unknown>, options?: { merge?: boolean }) => {
      operations.push({ type: 'set', path: reference.path, data: resolveTransforms(payload, undefined) as Record<string, unknown>, merge: options?.merge === true });
    },
    update: (reference: StoreDocumentReference, payload: Record<string, unknown>) => {
      operations.push({ type: 'update', path: reference.path, data: payload });
    },
    delete: (reference: StoreDocumentReference) => {
      operations.push({ type: 'delete', path: reference.path });
    },
  };
  const result = await callback(transaction);
  if (operations.length) await applyBatch(operations);
  return result;
}

export function onSnapshot(source: StoreDocumentReference, next: (snapshot: StoreDocumentSnapshot) => void, onError?: (error: Error) => void): () => void;
export function onSnapshot(source: StoreDocumentReference, options: Record<string, unknown>, next: (snapshot: StoreDocumentSnapshot) => void, onError?: (error: Error) => void): () => void;
export function onSnapshot(source: StoreCollectionReference | StoreQuery, next: (snapshot: StoreQuerySnapshot) => void, onError?: (error: Error) => void): () => void;
export function onSnapshot(source: StoreCollectionReference | StoreQuery, options: Record<string, unknown>, next: (snapshot: StoreQuerySnapshot) => void, onError?: (error: Error) => void): () => void;
export function onSnapshot(
  source: Source,
  nextOrOptions: ((snapshot: any) => void) | Record<string, unknown>,
  nextOrError?: ((snapshot: any) => void) | ((error: unknown) => void),
  maybeError?: (error: Error) => void,
) {
  const next = typeof nextOrOptions === 'function'
    ? nextOrOptions
    : typeof nextOrError === 'function' ? nextOrError : () => {};
  const errorHandler = typeof nextOrOptions === 'function'
    ? typeof nextOrError === 'function' ? nextOrError : maybeError
    : maybeError;
  const client = requireSupabase();
  let stopped = false;
  const emit = async () => {
    try {
      const result = source.kind === 'document'
        ? snapshotFor(source.path, await readDocument(source))
        : querySnapshot(await readCollection(source));
      if (!stopped) next(result);
    } catch (error) {
      if (!stopped) errorHandler?.(error instanceof Error ? error : new Error(String(error)));
    }
  };
  void emit();
  let fallbackPolling: ReturnType<typeof setInterval> | undefined;
  const stopFallbackPolling = () => {
    if (fallbackPolling === undefined) return;
    clearInterval(fallbackPolling);
    fallbackPolling = undefined;
  };
  const startFallbackPolling = () => {
    if (stopped || fallbackPolling !== undefined) return;
    // Realtime is an optimization, not a requirement for reading store data.
    // Keep snapshots fresh if the project has not enabled this table for
    // replication, without turning a channel status into a user-facing error.
    void emit();
    fallbackPolling = setInterval(() => void emit(), 15_000);
  };
  const channel = client
    .channel(`store-documents-${globalThis.crypto?.randomUUID?.() || Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'store_documents' }, () => void emit())
    .subscribe(status => {
      if (stopped) return;
      if (status === 'SUBSCRIBED') stopFallbackPolling();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startFallbackPolling();
    });
  return () => {
    stopped = true;
    stopFallbackPolling();
    void client.removeChannel(channel);
  };
}

export function disableNetwork() {}
export function enableNetwork() {}
