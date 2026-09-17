import { API_BASE_URL } from './config';
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
} from './types';

async function fetchWithTimeout(url: string, options: RequestInit = {}) {
  const timeout = 10000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Get Error (${path}):`, error);
    throw error;
  }
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Post Error (${path}):`, error);
    throw error;
  }
}

export async function apiPatch<T>(path: string, body: any): Promise<T> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Patch Error (${path}):`, error);
    throw error;
  }
}

export async function apiDelete(path: string): Promise<void> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
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

export function getCycles(): Promise<Cycle[]> {
  return apiGet<Cycle[]>('/api/cycles');
}

export function getCycleDetail(id: string): Promise<CycleDetail> {
  return apiGet<CycleDetail>(`/api/cycles/${id}`);
}

export function getOrders(cycleId?: string): Promise<Order[]> {
  const query = cycleId ? `?cycleId=${cycleId}` : '';
  return apiGet<Order[]>(`/api/orders${query}`);
}

export function createOrder(data: CreateOrderPayload): Promise<Order> {
  return apiPost<Order>('/api/orders', data);
}

export function togglePayment(orderId: string, status: 'paid' | 'unpaid'): Promise<void> {
  return apiPatch<void>(`/api/orders/${orderId}`, { paymentStatus: status });
}

export function getMembers(): Promise<Member[]> {
  return apiGet<Member[]>('/api/members');
}

export function getProducts(): Promise<Product[]> {
  return apiGet<Product[]>('/api/products');
}

export function getGroups(): Promise<Group[]> {
  return apiGet<Group[]>('/api/groups');
}

export function getCyclePrices(cycleId: string): Promise<WeeklyPrice[]> {
  return apiGet<WeeklyPrice[]>(`/api/cycles/${cycleId}/prices`);
}

export function getCycleRotation(cycleId: string): Promise<RotationSchedule[]> {
  return apiGet<RotationSchedule[]>(`/api/cycles/${cycleId}/rotation`);
}

export function updateCycleStatus(cycleId: string, status: string): Promise<void> {
  return apiPatch<void>(`/api/cycles/${cycleId}`, { status });
}

export function getInventory(cycleId?: string): Promise<InventoryResponse> {
  const query = cycleId ? `?cycleId=${cycleId}` : '';
  return apiGet<InventoryResponse>(`/api/inventory${query}`);
}

export function getReports(type: string = 'financial'): Promise<any> {
  return apiGet<any>(`/api/reports?type=${type}`);
}

