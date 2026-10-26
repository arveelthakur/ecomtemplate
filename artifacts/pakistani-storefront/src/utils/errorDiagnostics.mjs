const redactionPatterns = [
  [/Bearer\s+[^\s"'`]+/gi, 'Bearer [redacted]'],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[redacted token]'],
  [/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]{10,}\b/gi, '[redacted key]'],
  [/([?&](?:token|key|apikey|api_key|access_token|refresh_token)=)[^&\s]+/gi, '$1[redacted]'],
  [/((?:api[_-]?key|service[_-]?role(?:[_-]?key)?|anon[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]'],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]'],
  [/\b(?:\+?92|0)3\d{9}\b/g, '[redacted phone]'],
];

export function redactDiagnostic(value) {
  return redactionPatterns.reduce(
    (safe, [pattern, replacement]) => safe.replace(pattern, replacement),
    String(value ?? ''),
  ).slice(0, 4000);
}

export function createDiagnosticReport(error, componentStack, pathname) {
  const trace = String(componentStack ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join('\n');
  return redactDiagnostic([
    `Route: ${pathname || '/'}`,
    `Error: ${error?.name || 'Error'}: ${error?.message || 'No error message'}`,
    trace ? `Component trace:\n${trace}` : '',
  ].filter(Boolean).join('\n'));
}
