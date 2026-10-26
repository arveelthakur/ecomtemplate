import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabase, supabase } from './client';

export type StorageReference = {
  bucket: string;
  fullPath: string;
  name: string;
};
type UploadSnapshot = { bytesTransferred: number; totalBytes: number; state: 'running' | 'success' | 'error' };
type UploadListener = (snapshot: UploadSnapshot) => void;
type UploadTask = {
  on: (event: 'state_changed', next?: UploadListener, error?: (failure: Error) => void, complete?: () => void) => void;
  cancel: () => boolean;
};

export const defaultBucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET?.trim() || 'store-assets';

export function getSupabaseStorage(): SupabaseClient['storage'] | null {
  return supabase?.storage || null;
}

function createReference(bucket: string, fullPath: string): StorageReference {
  const normalized = fullPath.replace(/^\/+/, '').replace(/\/+/g, '/');
  const name = normalized.split('/').at(-1) || '';
  return { bucket, fullPath: normalized, name };
}

export function ref(storage: SupabaseClient['storage'] | null, pathOrUrl: string): StorageReference {
  if (!storage) throw new Error('Supabase Storage is not configured.');
  try {
    const url = new URL(pathOrUrl);
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (match) return createReference(decodeURIComponent(match[1]), match[2].split('/').map(decodeURIComponent).join('/'));
  } catch {
    // A relative object path is expected for uploads and storage listings.
  }
  return createReference(defaultBucket, pathOrUrl);
}

export async function getDownloadURL(reference: StorageReference): Promise<string> {
  const { data } = requireSupabase().storage.from(reference.bucket).getPublicUrl(reference.fullPath);
  if (!data.publicUrl) throw new Error('Supabase Storage did not return a public asset URL.');
  return data.publicUrl;
}

export async function list(
  reference: StorageReference,
  options: { maxResults?: number; limit?: number; pageToken?: string } = {},
) {
  const pageSize = Math.max(1, Math.min(100, Math.trunc(options.maxResults || options.limit || 40)));
  const offset = options.pageToken ? Number.parseInt(atob(options.pageToken), 10) || 0 : 0;
  const { data, error } = await requireSupabase().storage.from(reference.bucket).list(reference.fullPath, {
    limit: pageSize,
    offset,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;
  const items = (data || []).filter(item => item.id).map(item => createReference(
    reference.bucket,
    `${reference.fullPath}/${item.name}`,
  ));
  const nextOffset = offset + items.length;
  return {
    items,
    prefixes: (data || []).filter(item => !item.id).map(item => item.name),
    nextPageToken: items.length === pageSize ? btoa(String(nextOffset)) : undefined,
  };
}

export async function deleteObject(reference: StorageReference) {
  const { error } = await requireSupabase().storage.from(reference.bucket).remove([reference.fullPath]);
  if (error) throw error;
}

export function uploadBytesResumable(
  reference: StorageReference,
  data: Blob,
  metadata: { contentType?: string; cacheControl?: string } = {},
): UploadTask {
  let xhr: XMLHttpRequest | null = null;
  let listener: UploadListener | undefined;
  let failureListener: ((error: Error) => void) | undefined;
  let completeListener: (() => void) | undefined;
  let started = false;
  const task: UploadTask = {
    on(event, next, failure, complete) {
      if (event !== 'state_changed') return;
      listener = next;
      failureListener = failure;
      completeListener = complete;
      if (!started) {
        started = true;
        void beginUpload(reference, data, metadata, {
          progress: snapshot => listener?.(snapshot),
          complete: () => completeListener?.(),
          failure: error => failureListener?.(error),
          attach: request => { xhr = request; },
        });
      }
    },
    cancel() {
      if (!xhr) return false;
      xhr.abort();
      return true;
    },
  };
  return task;
}

async function beginUpload(
  reference: StorageReference,
  data: Blob,
  metadata: { contentType?: string; cacheControl?: string },
  callbacks: {
    progress: UploadListener;
    complete: () => void;
    failure: (error: Error) => void;
    attach: (xhr: XMLHttpRequest) => void;
  },
) {
  const client = requireSupabase();
  const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!baseUrl || !anonKey) {
    callbacks.failure(new Error('Supabase Storage configuration is missing.'));
    return;
  }
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    callbacks.failure(sessionError);
    return;
  }
  const request = new XMLHttpRequest();
  callbacks.attach(request);
  const objectPath = reference.fullPath.split('/').map(encodeURIComponent).join('/');
  request.open('POST', `${baseUrl}/storage/v1/object/${encodeURIComponent(reference.bucket)}/${objectPath}`);
  request.setRequestHeader('apikey', anonKey);
  request.setRequestHeader('authorization', `Bearer ${session.session?.access_token || anonKey}`);
  request.setRequestHeader('content-type', metadata.contentType || data.type || 'application/octet-stream');
  request.setRequestHeader('cache-control', `max-age=${metadata.cacheControl?.match(/max-age=(\d+)/)?.[1] || '3600'}`);
  request.setRequestHeader('x-upsert', 'false');
  request.upload.onprogress = event => callbacks.progress({
    bytesTransferred: event.loaded,
    totalBytes: event.lengthComputable ? event.total : data.size,
    state: 'running',
  });
  request.onerror = () => callbacks.failure(new Error('Supabase Storage upload failed due to a network error.'));
  request.onabort = () => callbacks.failure(new Error('Supabase Storage upload was cancelled.'));
  request.onload = () => {
    if (request.status < 200 || request.status >= 300) {
      callbacks.failure(new Error(`Supabase Storage upload failed (${request.status}).`));
      return;
    }
    callbacks.progress({ bytesTransferred: data.size, totalBytes: data.size, state: 'success' });
    callbacks.complete();
  };
  request.send(data);
}
