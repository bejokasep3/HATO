export interface Cycle {
  evaluatedAt?: string;
  id: string;
  label: string;
  status: string;
  periodStart: string;
  orderDeadline?: string;
  deliveryDate: string;
  notes?: string;
  periodEnd?: string | null;
  supplierDeadline?: string | null;
  periodState?: 'draft' | 'open' | 'closed' | null;
  version?: number;
  rulesVersion?: number;
  recapConfirmedAt?: string | null;
  receiptStatus?: string;
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
  consumerPrice: number;
  traderPrice: number;
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
  pricingPending?: boolean;
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
  version?: number;
  cancelledAt?: string | null;
  paymentSummary?: PaymentSummary;
}

export type PaymentSummary =
  | { status: 'unverified'; paidAmount: null; outstandingAmount: null }
  | { status: 'unpaid' | 'partial' | 'paid'; paidAmount: string; outstandingAmount: string };

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
  isActive: boolean;
}

export interface Group {
  id: string;
  name: string;
}

export interface TargetItem {
  groupCode: 'AYAM' | 'TAHU';
  unit: string;
  target: string | null;
  demand: string | null;
  status: 'known' | 'unknown';
  progress: null | { percentage: number | null; shortfall: string; excess: string; plannedPurchase: string };
}

export interface DashboardData {
  evaluatedAt?: string;
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
  finances: {
    orderCount: number;
    orderValue: string;
    receivedPayments: string;
    knownOutstanding: string;
    unknownBalanceCount: number;
    totalIncomplete: boolean;
    purchaseValue: string | null;
  } | null;
  recentOrders: Array<{
    id: string;
    memberName: string;
    groupName: string;
    totalAmount: string;
    paymentSummary: PaymentSummary;
    orderStatus: string;
    createdAt: string;
    itemCount: number;
  }>;
  totalMembers: number;
}

export interface CreateOrderPayload {
  cycleId: string;
  memberId: string;
  items: {
    productId: string;
    quantity: string;
    priceType: 'consumer' | 'trader';
  }[];
  notes?: string;
}

export interface AvailabilityItem {
  productId: string;
  productName: string;
  unit: string;
  capacity: string | null;
  allocated: string;
  shipped: string;
  availableToOrder: string | null;
  shortage: string | null;
  physicalRemaining: string | null;
  reserved: string | null;
  source: 'planned' | 'received' | 'unknown';
}

export interface AvailabilityResponse {
  cycleId: string;
  cycleVersion: number;
  items: AvailabilityItem[];
}

export interface PaymentRecord {
  id: string;
  amount: string;
  method: 'cash' | 'transfer' | 'other';
  source?: string;
  note?: string | null;
  occurredAt: string | null;
  createdAt?: string;
  reversedAt?: string | null;
  reversalReason?: string | null;
}

export interface OrderPaymentsResponse {
  pricingPending?: boolean;
  orderId: string;
  orderStatus: string;
  cancelledAt: string | null;
  version: number;
  member: { id: string; name: string; groupName: string | null };
  cycle: { id: string; label: string };
  totalAmount: string;
  summary: PaymentSummary;
  payments: PaymentRecord[];
}

export interface ReceivablesResponse {
  page: number;
  pageSize: number;
  totalCount: number;
  totalKnownOutstanding: string;
  unreconciledOrderCount: number;
  totalIncomplete: boolean;
  items: Array<{
    orderId: string;
    cycleId: string;
    cycleLabel: string;
    memberId: string;
    memberName: string;
    totalAmount: string;
    paidAmount: string;
    outstandingAmount: string;
  }>;
}

export interface SupplierRecapResponse {
  cycleId: string;
  cycleVersion: number;
  periodState: 'draft' | 'open' | 'closed';
  groups: Array<{ groupCode: 'AYAM' | 'TAHU'; target: string; demand: string; percentage: number | null; shortfall: string; plannedPurchase: string }>;
  items: Array<{ productId: string; productName: string; unit: string; groupCode: 'AYAM' | 'TAHU' | 'NONE'; demand: string }>;
  confirmed: null | {
    id: string;
    confirmedAt: string;
    items: Array<{ productId: string; productName: string; unit: string; groupCode: string; quantity: string }>;
    whatsappText: string;
  };
}

export interface InventoryItem {
  productId: string;
  productName: string;
  unit: string;
  capacity: string | null;
  allocated: string;
  shipped: string;
  availableToOrder: string | null;
  shortage: string | null;
  physicalRemaining: string | null;
  reserved: string | null;
  source: 'planned' | 'received' | 'unknown';
}

export interface InventoryResponse {
  cycleId: string;
  cycleVersion: number;
  receipt: null | {
    id: string;
    status: 'draft' | 'confirmed';
    receivedAt: string | null;
    supplierNote: string | null;
    version: number;
    confirmedAt: string | null;
    items: Array<{
      productId: string;
      orderedQty: string;
      receivedQty: string;
      damagedQty: string;
      purchasePrice: string;
      notes: string | null;
    }>;
  };
  items: InventoryItem[];
}

