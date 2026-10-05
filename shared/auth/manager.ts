export const MANAGER_USER_ID = 'admin'

const MANAGER_AUTH_EMAIL = 'admin@hato.invalid'

export function getManagerAuthEmail(userId: string): string | null {
  return userId.trim().toLowerCase() === MANAGER_USER_ID ? MANAGER_AUTH_EMAIL : null
}
