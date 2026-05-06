const MIN_PASSWORD_LENGTH = 8

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
    return 'Password harus mengandung huruf besar dan kecil.'
  }
  if (!/\d/.test(password)) {
    return 'Password harus mengandung minimal satu angka.'
  }
  return null
}
