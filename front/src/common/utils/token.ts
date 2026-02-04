const TOKEN_KEY = 'auth_token'
const TELEGRAM_USER_ID_KEY = 'telegram_user_id'

export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token)
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY)
  }
  return null
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function setStoredTelegramUserId(userId: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TELEGRAM_USER_ID_KEY, userId.toString())
  }
}

export function getStoredTelegramUserId(): number | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(TELEGRAM_USER_ID_KEY)
    return stored ? parseInt(stored, 10) : null
  }
  return null
}

export function clearStoredTelegramUserId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TELEGRAM_USER_ID_KEY)
  }
}
