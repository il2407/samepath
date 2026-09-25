const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return emailPattern.test(email) && email.length <= 254;
}

export function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 200 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

