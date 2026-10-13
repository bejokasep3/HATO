import {
  legacyCycleDetailSchema, legacyCyclesSchema, legacyMembersSchema, legacyOrdersSchema,
  legacyPricesSchema, legacyProductsSchema, legacyRotationsSchema,
} from '../../shared/contracts/legacy';
import type { Cycle, CycleDetail, Member, Order, Product, RotationSchedule, WeeklyPrice } from './types';

export function parseCycles(value: unknown): Cycle[] {
  return legacyCyclesSchema.parse(value);
}

export function parsePrices(value: unknown): WeeklyPrice[] {
  return legacyPricesSchema.parse(value).map((price) => {
    const consumerPrice = Number(price.consumerPrice ?? price.price);
    const traderPrice = Number(price.traderPrice ?? price.consumerPrice ?? price.price);
    if (!Number.isFinite(consumerPrice) || !Number.isFinite(traderPrice)) throw new Error('Harga siklus tidak valid');
    return {
      id: price.id, cycleId: price.cycleId, productId: price.productId,
      productName: price.product.name, price: Number(price.price), consumerPrice, traderPrice,
    };
  });
}

export function parseOrders(value: unknown): Order[] {
  return legacyOrdersSchema.parse(value).map((order) => ({
    id: order.id, cycleId: order.cycleId, memberId: order.memberId,
    memberName: order.member?.name || 'Anggota', groupName: order.member?.group?.name,
    totalAmount: Number(order.totalAmount), paymentStatus: order.paymentStatus,
    pricingPending: order.pricingPending === true,
    orderStatus: order.orderStatus, createdAt: order.createdAt,
  }));
}

export function parseMembers(value: unknown): Member[] {
  return legacyMembersSchema.parse(value).map((member) => ({
    id: member.id, name: member.name, phone: member.phone,
    groupId: member.groupId, groupName: member.group?.name, role: member.role,
  }));
}

export function parseProducts(value: unknown): Product[] {
  return legacyProductsSchema.parse(value).map((product) => ({
    id: product.id, name: product.name, unit: product.unit, isActive: product.isActive,
  }));
}

export function parseRotations(value: unknown): RotationSchedule[] {
  return legacyRotationsSchema.parse(value).map((schedule) => ({
    id: schedule.id, cycleId: schedule.cycleId, memberId: schedule.memberId, status: schedule.status,
    member: schedule.member ? {
      id: schedule.member.id, scheduleId: schedule.id, name: schedule.member.name,
      phone: schedule.member.phone, groupName: schedule.member.group?.name || '-',
      role: schedule.member.role, isOrdered: schedule.status === 'ordered', status: schedule.status,
    } : undefined,
  }));
}

export function parseCycleDetail(value: unknown): CycleDetail {
  const { cycle } = legacyCycleDetailSchema.parse(value);
  return {
    id: cycle.id, label: cycle.label, status: cycle.status,
    periodStart: cycle.periodStart, orderDeadline: cycle.orderDeadline,
    deliveryDate: cycle.deliveryDate,
    periodEnd: cycle.periodEnd, supplierDeadline: cycle.supplierDeadline,
    periodState: cycle.periodState, version: cycle.version, rulesVersion: cycle.rulesVersion,
    evaluatedAt: cycle.evaluatedAt,
    weeklyPrices: parsePrices(cycle.weeklyPrices),
    rotation: parseRotations(cycle.rotationSchedules),
    orders: parseOrders(cycle.orders),
  };
}
