import { apiErrorSchema } from '../../shared/contracts/common'

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId: string | null,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export type MutationOptions = {
  idempotencyKey?: string
  signal?: AbortSignal
}

function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16)
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16)
  })
}

export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? fallbackUuid()
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null)
  if (response.ok) return body as T

  const parsed = apiErrorSchema.safeParse(body)
  if (parsed.success) {
    throw new ApiClientError(
      parsed.data.error.message,
      response.status,
      parsed.data.error.code,
      parsed.data.requestId,
      parsed.data.error.fieldErrors,
    )
  }
  const legacyMessage = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
    ? body.error
    : `Permintaan gagal (HTTP ${response.status})`
  throw new ApiClientError(legacyMessage, response.status, 'HTTP_ERROR', null)
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Hato-Client', '2')
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...init, headers, cache: 'no-store' })
  return parseResponse<T>(response)
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'GET', signal })
}

function mutate<T>(method: 'POST' | 'PATCH' | 'PUT', path: string, body: unknown, options: MutationOptions = {}): Promise<T> {
  return request<T>(path, {
    method,
    body: JSON.stringify(body),
    signal: options.signal,
    headers: { 'Idempotency-Key': options.idempotencyKey ?? newIdempotencyKey() },
  })
}

export function apiPost<T>(path: string, body: unknown, options?: MutationOptions): Promise<T> {
  return mutate<T>('POST', path, body, options)
}

export function apiPatch<T>(path: string, body: unknown, options?: MutationOptions): Promise<T> {
  return mutate<T>('PATCH', path, body, options)
}

export function apiPut<T>(path: string, body: unknown, options?: MutationOptions): Promise<T> {
  return mutate<T>('PUT', path, body, options)
}
