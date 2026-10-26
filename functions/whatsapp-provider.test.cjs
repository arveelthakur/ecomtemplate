const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeWhatsAppPhone,
  sendWhatsAppTemplate,
  sendWhatsAppText,
} = require('./whatsapp-provider.cjs');

test('normalizes supported Pakistan mobile formats for Meta Cloud API', () => {
  assert.equal(normalizeWhatsAppPhone('03001234567'), '923001234567');
  assert.equal(normalizeWhatsAppPhone('+923001234567'), '923001234567');
  assert.equal(normalizeWhatsAppPhone('3001234567'), '923001234567');
});

test('does not attempt delivery when WhatsApp server configuration is incomplete', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    throw new Error('Unexpected network call');
  };
  assert.equal(await sendWhatsAppText({ token: '', phoneNumberId: '123', to: '923001234567', body: 'Hi', fetchImpl }), false);
  assert.equal(await sendWhatsAppTemplate({ token: 'token', phoneNumberId: '123', to: '', name: 'welcome', fetchImpl }), false);
  assert.equal(called, false);
});

test('sends text messages using the server-only Meta token and normalized recipient', async () => {
  let sentRequest;
  const fetchImpl = async (url, options) => {
    sentRequest = { url, options };
    return { ok: true, status: 200 };
  };
  assert.equal(await sendWhatsAppText({
    token: 'server-token',
    phoneNumberId: 'phone-number-id',
    to: '+923001234567',
    body: 'Order update',
    fetchImpl,
  }), true);
  assert.match(sentRequest.url, /phone-number-id\/messages$/);
  assert.equal(sentRequest.options.headers.Authorization, 'Bearer server-token');
  assert.deepEqual(JSON.parse(sentRequest.options.body), {
    messaging_product: 'whatsapp',
    to: '923001234567',
    type: 'text',
    text: { body: 'Order update' },
  });
});

test('sends approved templates with bounded body parameters', async () => {
  let sentPayload;
  const fetchImpl = async (_url, options) => {
    sentPayload = JSON.parse(options.body);
    return { ok: true, status: 200 };
  };
  assert.equal(await sendWhatsAppTemplate({
    token: 'server-token',
    phoneNumberId: 'phone-number-id',
    to: '03001234567',
    name: 'order_status',
    language: 'en',
    parameters: ['Customer', 'Order-1'],
    fetchImpl,
  }), true);
  assert.deepEqual(sentPayload.template.components[0].parameters, [
    { type: 'text', text: 'Customer' },
    { type: 'text', text: 'Order-1' },
  ]);
});
