# WhatsApp delivery

Outbound delivery uses the Meta Cloud API through `functions/whatsapp-provider.cjs` and the Vercel server route.

1. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, and `WHATSAPP_VERIFY_TOKEN` as server-only Vercel environment variables.
2. Set the WhatsApp phone-number ID and approved template names in the store's general settings.
3. Register `https://<your-domain>/api/store/whatsappWebhook` with Meta for both webhook verification and inbound messages.
4. Enable each automation only after the relevant approved template is available in Meta.

The webhook validates Meta's SHA-256 signature before processing a message. Abandoned-cart and order-status messages require the corresponding customer consent; campaigns only include customers whose `whatsappMarketingOptIn` value is true. Provider credentials never belong in store settings or browser variables.
