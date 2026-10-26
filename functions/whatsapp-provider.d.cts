export function normalizeWhatsAppPhone(value: unknown): string;
export function sendWhatsAppText(options: {
  token: string;
  phoneNumberId: string;
  to: string;
  body: string;
}): Promise<boolean>;
export function sendWhatsAppTemplate(options: {
  token: string;
  phoneNumberId: string;
  to: string;
  name: string;
  language?: string;
  parameters?: unknown[];
}): Promise<boolean>;
