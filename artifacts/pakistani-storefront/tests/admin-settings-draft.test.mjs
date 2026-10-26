import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminSettingsDraftIsSynced,
  mergeAdminSettingsDraft,
  resolvePendingAdminSaveState,
  sanitizeAdminSettingsDraft,
} from '../src/utils/adminSettingsDraft.ts';
import { normalizeCategoryDisplayMode } from '../src/utils/storefrontLayout.ts';

test('local settings drafts omit customer messages, credentials, payment destinations, and data URLs', () => {
  const sanitized = sanitizeAdminSettingsDraft({
    content: {
      floatingWidgets: { widgets: [{ id: 'chat', target: 'https://example.test/chat' }] },
      preview: 'data:image/png;base64,private-image-bytes',
    },
    settings: {
      general: { storeName: 'Nura', storeSubtitle: 'Thoughtful daily essentials' },
      paymentDetails: { bankAccounts: [{ accountNumberOrIban: '123456' }] },
      analytics: { measurementId: 'G-PRIVATE' },
      recaptchaSiteKey: 'public-key',
      apiToken: 'private-token',
    },
    inbox: [{ message: 'A customer message', email: 'customer@example.test' }],
  });

  assert.deepEqual(sanitized, {
    content: { floatingWidgets: { widgets: [{ id: 'chat', target: 'https://example.test/chat' }] } },
    settings: { general: { storeName: 'Nura', storeSubtitle: 'Thoughtful daily essentials' } },
  });
});

test('draft recovery preserves newer Supabase values and merges independent edits', () => {
  const baseline = {
    content: { story: { title: 'Saved title', copy: 'Saved copy' }, widgets: [{ id: 'saved' }] },
    settings: { general: { storeName: 'Nura', deliveryFee: 200 } },
  };
  const draft = {
    content: { story: { title: 'Local title', copy: 'Saved copy' }, widgets: [{ id: 'local' }] },
    settings: { general: { storeName: 'Local store name', deliveryFee: 250 } },
  };
  const latest = {
    content: { story: { title: 'Saved title', copy: 'New remote copy' }, widgets: [{ id: 'remote' }] },
    settings: { general: { storeName: 'New store name', deliveryFee: 200 } },
  };

  const result = mergeAdminSettingsDraft(baseline, draft, latest);
  assert.deepEqual(result.value, {
    content: {
      story: { title: 'Local title', copy: 'New remote copy' },
      widgets: [{ id: 'remote' }],
    },
    settings: { general: { storeName: 'New store name', deliveryFee: 250 } },
  });
  assert.deepEqual(result.conflicts, ['content.widgets', 'settings.general.storeName']);
});

test('draft recovery treats Supabase object key reordering as unchanged', () => {
  const baseline = { content: { floatingWidgets: { widgets: [{ id: 'offer', label: 'Saved', color: '#123456' }] } } };
  const draft = { content: { floatingWidgets: { widgets: [{ id: 'offer', label: 'Local edit', color: '#123456' }] } } };
  const latest = { content: { floatingWidgets: { widgets: [{ color: '#123456', label: 'Saved', id: 'offer' }] } } };

  const merged = mergeAdminSettingsDraft(baseline, draft, latest);

  assert.equal(merged.value.content.floatingWidgets.widgets[0].label, 'Local edit');
  assert.deepEqual(merged.conflicts, []);
});

test('a recovery draft already committed to Supabase is recognized as synced', () => {
  const baseline = {
    content: { hero: { title: 'Before', subtitle: 'Original' } },
    settings: { general: { storeName: 'Nura' } },
  };
  const draft = {
    content: { hero: { title: 'New title', subtitle: 'Original' } },
    settings: { general: { storeName: 'Nura' } },
  };
  const latest = {
    content: { hero: { subtitle: 'Original', title: 'New title' } },
    settings: { general: { storeName: 'Nura' } },
  };

  assert.equal(adminSettingsDraftIsSynced(baseline, draft, latest, ['content.hero']), true);
});

test('a conflicting unsaved edit remains recoverable instead of being auto-discarded', () => {
  const baseline = { content: { hero: { title: 'Before' } }, settings: {} };
  const draft = { content: { hero: { title: 'Local edit' } }, settings: {} };
  const latest = { content: { hero: { title: 'Newer remote edit' } }, settings: {} };

  assert.equal(adminSettingsDraftIsSynced(baseline, draft, latest, ['content.hero']), false);
});

test('a successful scoped save clears pending state despite unrelated store-data differences', () => {
  assert.deepEqual(resolvePendingAdminSaveState({
    writesAtStart: 1,
    writesNow: 1,
    savedScopes: ['settings.general'],
    pendingScopesAtStart: ['settings.general'],
    scopesRequestedDuringSave: [],
  }), {
    pending: false,
    pendingCount: 0,
    pendingScopes: [],
    changedDuringSave: false,
  });
});

test('scoped saves preserve unsaved scopes and edits made while the request is running', () => {
  assert.deepEqual(resolvePendingAdminSaveState({
    writesAtStart: 2,
    writesNow: 3,
    savedScopes: ['content.story'],
    pendingScopesAtStart: ['content.story', 'settings.general'],
    scopesRequestedDuringSave: ['content.story'],
  }), {
    pending: true,
    pendingCount: 1,
    pendingScopes: ['settings.general', 'content.story'],
    changedDuringSave: true,
  });
});

test('category layout hydration accepts legacy single-row and marquee settings', () => {
  assert.equal(normalizeCategoryDisplayMode('grid'), 'grid');
  assert.equal(normalizeCategoryDisplayMode('horizontal'), 'horizontal');
  assert.equal(normalizeCategoryDisplayMode('single-row'), 'horizontal');
  assert.equal(normalizeCategoryDisplayMode('marquee'), 'horizontal');
  assert.equal(normalizeCategoryDisplayMode('unexpected'), 'grid');
});
