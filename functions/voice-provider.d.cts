export function publicHttpsEndpoint(value: unknown): string;
export function requestVoiceApi(options: {
  endpoint: unknown;
  username?: string;
  password?: string;
  token?: string;
  method?: 'GET' | 'POST';
  body?: unknown;
}): Promise<{ configured: boolean; status: number; data: unknown }>;
export function parseCallResult(payload: unknown): {
  status: string;
  providerStatus: string;
  callId: string;
  duration: number | null;
  userResponse: string;
};
export function parseBalance(payload: unknown): {
  available: boolean;
  balance: number | null;
  currency: string;
};
