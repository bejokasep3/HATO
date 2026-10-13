import { API_BASE_URL } from './config';
import { getNativeSupabase } from './auth';
import { parseCycleDetail, parseCycles, parseMembers, parseOrders, parsePrices, parseProducts, parseRotations } from './legacy-adapters';
import {
  DashboardData,
  Cycle,
  CycleDetail,
  Order,
  Member,
  Product,
  Group,
  WeeklyPrice,
  RotationSchedule,
  CreateOrderPayload,
  InventoryResponse,
  AvailabilityResponse,
  OrderPaymentsResponse,
  PaymentRecord,
  ReceivablesResponse,
  SupplierRecapResponse,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type MutationOptions = { idempotencyKey?: string };

function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? fallbackUuid();
}

async function fetchWithTimeout(url: string, options: RequestInit = {}) {
  const supabase = getNativeSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sesi habis. Masuk kembali.');

  async function attempt(token: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('X-Hato-Client', '2');
      return await fetch(url, { ...options, headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  const first = await attempt(data.session.access_token);
  if (first.status !== 401) return first;
  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session) throw new Error('Sesi habis. Masuk kembali.');
  return attempt(refreshed.data.session.access_token);
}

async function throwApiError(response: Response): Promise<never> {
  const body: unknown = await response.json().catch(() => null);
  let message = `Permintaan gagal (HTTP ${response.status})`;
  let code = 'HTTP_ERROR';
  let requestId: string | null = null;
  if (body && typeof body === 'object' && 'error' in body) {
    const detail = body.error;
    if (typeof detail === 'string') message = detail;
    if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') {
      message = detail.message;
    }
    if (detail && typeof detail === 'object' && 'code' in detail && typeof detail.code === 'string') code = detail.code;
    if ('requestId' in body && typeof body.requestId === 'string') requestId = body.requestId;
  }
  throw new ApiError(message, response.status, code, requestId);
}

export async function apiGet<T>(path: string): Promise<T> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return throwApiError(response);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Get Error (${path}):`, error);
    throw error;
  }
}

export async function apiPost<T>(path: string, body: unknown, options: MutationOptions = {}): Promise<T> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': options.idempotencyKey ?? newIdempotencyKey(),
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      return throwApiError(response);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Post Error (${path}):`, error);
    throw error;
  }
}

export async function apiPatch<T>(path: string, body: unknown, options: MutationOptions = {}): Promise<T> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': options.idempotencyKey ?? newIdempotencyKey(),
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      return throwApiError(response);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Patch Error (${path}):`, error);
    throw error;
  }
}

export async function updateCyclePrices(cycleId: string, body: { expectedVersion: number; items: { productId: string; consumerPrice: string; traderPrice: string }[] }, options: MutationOptions = {}): Promise<Cycle> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/cycles/${cycleId}/prices`, {
    method: 'PUT',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': options.idempotencyKey ?? newIdempotencyKey() },
    body: JSON.stringify(body),
  });
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export async function apiDelete(path: string): Promise<void> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      return throwApiError(response);
    }
  } catch (error) {
    console.error(`API Delete Error (${path}):`, error);
    throw error;
  }
}

export function getDashboard(cycleId?: string): Promise<DashboardData> {
  const query = cycleId ? `?cycleId=${cycleId}` : '';
  return apiGet<DashboardData>(`/api/dashboard${query}`);
}

export async function getCycles(): Promise<Cycle[]> {
  return parseCycles(await apiGet<unknown>('/api/cycles'));
}

export async function getCycleDetail(id: string): Promise<CycleDetail> {
  return parseCycleDetail(await apiGet<unknown>(`/api/cycles/${id}`));
}

export async function getOrders(cycleId?: string): Promise<Order[]> {
  const query = cycleId ? `?cycleId=${cycleId}` : '';
  return parseOrders(await apiGet<unknown>(`/api/orders${query}`));
}

export function createOrder(data: CreateOrderPayload, options?: MutationOptions): Promise<Order> {
  return apiPost<Order>('/api/orders', data, options);
}

export function getAvailability(cycleId: string): Promise<AvailabilityResponse> {
  return apiGet<AvailabilityResponse>(`/api/cycles/${cycleId}/availability`);
}

export function getSupplierRecap(cycleId: string): Promise<SupplierRecapResponse> {
  return apiGet<SupplierRecapResponse>(`/api/cycles/${cycleId}/supplier-recap`);
}

export function confirmSupplierRecap(
  cycleId: string,
  data: { expectedVersion: number; items: Array<{ productId: string; quantity: string }> },
  options?: MutationOptions,
): Promise<unknown> {
  return apiPost<unknown>(`/api/cycles/${cycleId}/supplier-recap`, data, options);
}

export function updateCycleTargets(
  cycleId: string,
  data: { expectedVersion: number; reason: string; targets: Array<{ groupCode: 'AYAM' | 'TAHU'; quantity: string }> },
  options?: MutationOptions,
): Promise<Cycle> {
  return apiPatch<Cycle>(`/api/cycles/${cycleId}/targets`, data, options);
}

export function getOrderPayments(orderId: string): Promise<OrderPaymentsResponse> {
  return apiGet<OrderPaymentsResponse>(`/api/orders/${orderId}/payments`);
}

export function addPayment(
  orderId: string,
  data: { amount: string; method: PaymentRecord['method']; occurredAt?: string; note?: string | null },
  options?: MutationOptions,
): Promise<PaymentRecord & { orderId: string; orderVersion: number; summary: OrderPaymentsResponse['summary'] }> {
  return apiPost(`/api/orders/${orderId}/payments`, data, options);
}

export function reversePayment(
  paymentId: string,
  reason: string,
  options?: MutationOptions,
): Promise<{ id: string; orderId: string; reversedAt: string; orderVersion: number; summary: OrderPaymentsResponse['summary'] }> {
  return apiPost(`/api/payments/${paymentId}/reverse`, { reason }, options);
}

export function getReceivables(params: { page?: number; pageSize?: number; cycleId?: string; groupId?: string } = {}): Promise<ReceivablesResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.cycleId) query.set('cycleId', params.cycleId);
  if (params.groupId) query.set('groupId', params.groupId);
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiGet<ReceivablesResponse>(`/api/payments/receivables${suffix}`);
}

export function openCycle(cycleId: string, expectedVersion: number, options?: MutationOptions): Promise<Cycle> {
  return apiPost<Cycle>(`/api/cycles/${cycleId}/open`, { expectedVersion }, options);
}

export function closeCycle(cycleId: string, expectedVersion: number, options?: MutationOptions): Promise<Cycle> {
  return apiPost<Cycle>(`/api/cycles/${cycleId}/close`, { expectedVersion }, options);
}


export async function getMembers(): Promise<Member[]> {
  return parseMembers(await apiGet<unknown>('/api/members?active=true'));
}

export async function getProducts(): Promise<Product[]> {
  return parseProducts(await apiGet<unknown>('/api/products?active=true'));
}

export function getGroups(): Promise<Group[]> {
  return apiGet<Group[]>('/api/groups');
}

export async function getCyclePrices(cycleId: string): Promise<WeeklyPrice[]> {
  return parsePrices(await apiGet<unknown>(`/api/cycles/${cycleId}/prices`));
}

export async function getCycleRotation(cycleId: string): Promise<RotationSchedule[]> {
  return parseRotations(await apiGet<unknown>(`/api/cycles/${cycleId}/rotation`));
}


export function getInventory(cycleId?: string): Promise<InventoryResponse> {
  const query = cycleId ? `?cycleId=${cycleId}` : '';
  return apiGet<InventoryResponse>(`/api/inventory${query}`);
}

export function saveReceiptDraft(
  data: {
    cycleId: string;
    expectedVersion: number;
    supplierNote?: string | null;
    items: Array<{ productId: string; receivedQty: string; damagedQty: string; purchasePrice: string; notes?: string | null }>;
  },
  options?: MutationOptions,
): Promise<{ id: string; cycleId: string; status: 'draft'; version: number; cycleVersion: number }> {
  return apiPost('/api/inventory', data, options);
}

export function confirmReceipt(cycleId: string, expectedVersion: number, options?: MutationOptions): Promise<unknown> {
  return apiPost(`/api/inventory/${cycleId}/confirm`, { expectedVersion }, options);
}

export function updateOrderFulfillment(
  orderId: string,
  data: { expectedVersion: number; status: 'confirmed' | 'shipped' | 'delivered' },
  options?: MutationOptions,
): Promise<{ id: string; version: number; orderStatus: string }> {
  return apiPost(`/api/orders/${orderId}/fulfillment`, data, options);
}

export function getReports(type: string = 'financial'): Promise<any> {
  return apiGet<any>(`/api/reports?type=${type}`);
}

