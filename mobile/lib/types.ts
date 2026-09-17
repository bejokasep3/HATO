export interface Cycle {
  id: string;
  label: string;
  status: string;
  periodStart: string;
  orderDeadline: string;
  deliveryDate: string;
  notes?: string;
}

export interface CycleDetail extends Cycle {
  weeklyPrices: WeeklyPrice[];
  rotation: RotationSchedule[];
  orders: Order[];
}

export interface WeeklyPrice {
  id: string;
  cycleId: string;
  productId: string;
  productName: string;
  price: number;
}

export interface RotationMember {
  id: string;
  scheduleId: string;
  name: string;
  phone: string;
  groupName: string;
  role: string;
  isOrdered: boolean;
  status: string;
}

export interface RotationSchedule {
  id: string;
  cycleId: string;
  memberId: string;
  status: string;
  notes?: string;
  member?: RotationMember;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  cycleId: string;
  memberId: string;
  memberName: string;
  groupName?: string;
  totalAmount: number;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  itemCount?: number;
  items?: OrderItem[];
  member?: Member;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  groupId: string;
  groupName?: string;
  role: string;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  defaultPrice: number;
}

export interface Group {
  id: string;
  name: string;
}

export interface TargetItem {
  id: string;
  name: string;
  unit: string;
  targetQuantity: number;
  actualQuantity: number;
  percentage: number;
  isMet: boolean;
  breakdown?: { name: string; quantity: number }[];
}

export interface DashboardData {
  hasCycle: boolean;
  allCycles: Cycle[];
  currentCycle: Cycle | null;
  targets: TargetItem[];
  rotation: {
    scheduledCount: number;
    orderedCount: number;
    percentage: number;
    pendingMembers: RotationMember[];
    members: RotationMember[];
  };
  payments: {
    totalOrders: number;
    totalBilling: number;
    paidAmount: number;
    unpaidAmount: number;
    paidCount: number;
    unpaidCount: number;
  };
  recentOrders: Order[];
  totalMembers: number;
}

export interface CreateOrderPayload {
  cycleId: string;
  memberId: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
  paymentStatus?: string;
  notes?: string;
}

export interface InventoryItem {
  productId: string;
  productName: string;
  unit: string;
  category: string | null;
  isTarget: boolean;
  orderedQty: number;
  receivedQty: number;
  damagedQty: number;
  purchasePrice: number;
  totalCost: number;
  revenue: number;
  margin: number;
  difference: number;
  notes: string;
}

export interface InventoryResponse {
  cycle: Cycle;
  receipt: {
    id: string;
    status: string;
    receivedAt: string;
    supplierNote: string | null;
  } | null;
  summary: {
    totalOrderedQty: number;
    totalReceivedQty: number;
    totalDamagedQty: number;
    totalPurchaseCost: number;
    totalRevenue: number;
    grossMargin: number;
    marginPercentage: number;
    hasDiscrepancy: boolean;
  };
  items: InventoryItem[];
}

