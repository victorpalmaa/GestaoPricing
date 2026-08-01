const PERMISSION_ERROR_PATTERNS = [
  /permission denied/i,
  /row-level security/i,
  /violates row-level security/i,
  /new row violates row-level security/i,
  /insufficient privilege/i,
  /42501/,
];

export function isPermissionError(error) {
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  const hint = String(error?.hint || "");
  const code = String(error?.code || "");
  const combined = `${message} ${details} ${hint} ${code}`;

  return PERMISSION_ERROR_PATTERNS.some((pattern) => pattern.test(combined));
}

export function getPermissionErrorMessage(defaultMessage = "Esta ação não é permitida para a área da sua conta.") {
  return defaultMessage;
}
