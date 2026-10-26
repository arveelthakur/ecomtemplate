'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deliverEmail,
  findSender,
  providerStatus,
  renderEmail,
} = require('./email-engine.cjs');

const settings = {
  provider: 'resend',
  defaultSenderProfileId: 'orders',
  senderProfiles: [{ id: 'orders', name: 'Nura Orders', email: 'orders@example.pk' }],
  templates: {
    orderReceipt: { subject: 'Order {order_id}', body: 'Hello {customer_name}\n{items_list}' },
  },
  branding: {
    logoUrl: 'https://cdn.example.pk/nura.png',
    accentColor: '#6b2447',
    footerCopyright: 'Made thoughtfully in Pakistan.',
    socialLinks: { instagram: 'https://instagram.com/nura', facebook: '', whatsapp: '+92 300 1234567' },
  },
  smtp: { host: '', port: 587, username: '', secure: false },
};

test('renders approved template values as escaped HTML and preserves plain text', () => {
  const rendered = renderEmail({
    settings,
    templateId: 'orderReceipt',
    values: {
      order_id: 'NURA-12',
      customer_name: '<script>alert(1)</script>',
      items_list: '2 × Face Oil',
    },
  });
  assert.equal(rendered.subject, 'Order NURA-12');
  assert.equal(rendered.text, 'Hello <script>alert(1)</script>\n2 × Face Oil');
  assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(rendered.html, /<script>alert/);
  assert.match(rendered.html, /https:\/\/cdn\.example\.pk\/nura\.png/);
});

test('email templates resolve the configured store name without rewriting order identifiers', () => {
  const rendered = renderEmail({
    settings,
    templateId: 'orderReceipt',
    template: { subject: 'Your Nura order {order_id}', body: 'Thanks for shopping with Nura.' },
    values: { store_name: 'Studio & Co', order_id: 'NURA-12' },
  });
  assert.equal(rendered.subject, 'Your Studio & Co order NURA-12');
  assert.match(rendered.text, /Studio & Co/);
  assert.match(rendered.html, /Studio &amp; Co/);
  assert.doesNotMatch(rendered.subject, /our store/);
});

test('reports that email cannot send without server-side provider secrets', () => {
  const status = providerStatus(settings, {});
  assert.equal(status.provider, 'resend');
  assert.equal(status.credentialsConfigured, false);
  assert.equal(status.canSend, false);
  assert.match(status.detail, /RESEND_API_KEY/);
});

test('validates sender profiles and blocks provider calls when a key is missing', async () => {
  assert.deepEqual(findSender(settings, 'orders'), { name: 'Nura Orders', email: 'orders@example.pk' });
  await assert.rejects(
    deliverEmail({
      settings,
      sender: findSender(settings, 'orders'),
      to: 'customer@example.pk',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
      secrets: {},
      fetchImpl: async () => { throw new Error('must not call network'); },
    }),
    /Resend API secret is not configured/,
  );
});

test('sends Resend requests only when server credentials exist', async () => {
  let captured;
  const result = await deliverEmail({
    settings,
    sender: findSender(settings, 'orders'),
    to: 'customer@example.pk',
    subject: 'Test',
    html: '<p>Test</p>',
    text: 'Test',
    secrets: { resendApiKey: 'test-only-secret' },
    fetchImpl: async (url, init) => {
      captured = { url, init, payload: JSON.parse(init.body) };
      return { ok: true, status: 200, json: async () => ({ id: 'email-test-1' }) };
    },
  });
  assert.equal(result.provider, 'resend');
  assert.equal(result.messageId, 'email-test-1');
  assert.equal(captured.url, 'https://api.resend.com/emails');
  assert.equal(captured.payload.to[0], 'customer@example.pk');
  assert.equal(captured.payload.from, 'Nura Orders <orders@example.pk>');
});

test('does not expose SMTP passwords in provider status', () => {
  const smtpSettings = {
    ...settings,
    provider: 'smtp',
    smtp: { host: 'smtp.example.pk', port: 587, username: 'orders@example.pk', secure: false },
  };
  const status = providerStatus(smtpSettings, { smtpPassword: 'smtp-secret' });
  assert.equal(status.canSend, true);
  assert.equal(JSON.stringify(status).includes('smtp-secret'), false);
});

test('uses server-side SMTP credentials through the transporter adapter', async () => {
  const smtpSettings = {
    ...settings,
    provider: 'smtp',
    smtp: { host: 'smtp.example.pk', port: 587, username: 'orders@example.pk', secure: false },
  };
  let transportOptions;
  let sentMessage;
  const result = await deliverEmail({
    settings: smtpSettings,
    sender: findSender(smtpSettings, 'orders'),
    to: 'customer@example.pk',
    subject: 'Order update',
    html: '<p>Order update</p>',
    text: 'Order update',
    secrets: { smtpPassword: 'server-only-password' },
    smtpModule: {
      createTransport(options) {
        transportOptions = options;
        return { sendMail: async message => {
          sentMessage = message;
          return { messageId: 'smtp-message-1' };
        } };
      },
    },
  });
  assert.equal(result.provider, 'smtp');
  assert.equal(result.messageId, 'smtp-message-1');
  assert.equal(transportOptions.auth.pass, 'server-only-password');
  assert.equal(sentMessage.to, 'customer@example.pk');
  assert.equal(sentMessage.subject, 'Order update');
});
