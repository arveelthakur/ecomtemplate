import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeAdminSettingsDraft,
  sanitizeAdminSettingsDraft,
} from '../src/utils/adminSettingsDraft.ts';

test('local settings drafts omit customer messages, credentials, payment destinations, and data URLs', () => {
  const sanitized = sanitizeAdminSettingsDraft({
    content: {
      floatingWidgets: { widgets: [{ id: 'chat', target: 'https://example.test/chat' }] },
      preview: 'data:image/png;base64,private-image-bytes',
    },
    settings: {
      general: { storeName: 'Nura' },
      paymentDetails: { bankAccounts: [{ accountNumberOrIban: '123456' }] },
      analytics: { measurementId: 'G-PRIVATE' },
      recaptchaSiteKey: 'public-key',
      apiToken: 'private-token',
    },
    inbox: [{ message: 'A customer message', email: 'customer@example.test' }],
  });

  assert.deepEqual(sanitized, {
    content: { floatingWidgets: { widgets: [{ id: 'chat', target: 'https://example.test/chat' }] } },
    settings: { general: { storeName: 'Nura' } },
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
