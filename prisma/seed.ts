import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Checking database state...')

  // Safety check: Prevent overwriting real user data unless FORCE_SEED=true
  const existingCount = await prisma.member.count()
  if (existingCount > 0 && process.env.FORCE_SEED !== 'true') {
    console.log(
      '⚠️  Database sudah memiliki data (' +
        existingCount +
        ' anggota terdaftar). Seeding dibatalkan agar data Anda tidak terhapus. (Gunakan FORCE_SEED=true jika memang ingin reset total).'
    )
    return
  }

  console.log('🌱 Starting database seeding...')

  // Clean existing data in reverse dependency order
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.rotationSchedule.deleteMany()
  await prisma.weeklyPrice.deleteMany()
  await prisma.cycle.deleteMany()
  await prisma.member.deleteMany()
  await prisma.group.deleteMany()
  await prisma.product.deleteMany()

  // 1. Create Root Management Group (Level 3)
  const managerGroup = await prisma.group.create({
    data: {
      name: 'Grup Distribusi Utama',
      level: 3,
      isActive: true,
    },
  })

  // 2. Create 5 Sub-groups (Level 2)
  const subGroupNames = [
    'Sub-Grup Mawar',
    'Sub-Grup Melati',
    'Sub-Grup Anggrek',
    'Sub-Grup Kenanga',
    'Sub-Grup Dahlia',
  ]

  const createdSubGroups = []
  for (const name of subGroupNames) {
    const sg = await prisma.group.create({
      data: {
        name,
        level: 2,
        parentGroupId: managerGroup.id,
        isActive: true,
      },
    })
    createdSubGroups.push(sg)
  }

  // 3. Create Products (including 2 core target products)
  const productsData = [
    {
      name: 'Ayam Segar',
      unit: 'kg',
      isTarget: true,
      targetQuantity: 20,
      category: 'Daging & Unggas',
      sortOrder: 1,
      defaultPrice: 38000,
      consumerPrice: 38000,
      traderPrice: 35000,
    },
    {
      name: 'Tahu Segar',
      unit: 'bungkus',
      isTarget: true,
      targetQuantity: 20,
      category: 'Olahan Kedelai',
      sortOrder: 2,
      defaultPrice: 8000,
    },
    {
      name: 'Beras Premium 5kg',
      unit: 'karung',
      isTarget: false,
      category: 'Sembako Pokok',
      sortOrder: 3,
      defaultPrice: 72000,
    },
    {
      name: 'Minyak Goreng 2L',
      unit: 'pouch',
      isTarget: false,
      category: 'Sembako Pokok',
      sortOrder: 4,
      defaultPrice: 34000,
    },
    {
      name: 'Telur Ayam 1kg',
      unit: 'kg',
      isTarget: false,
      category: 'Telur & Susu',
      sortOrder: 5,
      defaultPrice: 28000,
    },
    {
      name: 'Gula Pasir 1kg',
      unit: 'kg',
      isTarget: false,
      category: 'Sembako Pokok',
      sortOrder: 6,
      defaultPrice: 17500,
    },
  ]

  const createdProducts = []
  for (const p of productsData) {
    const prod = await prisma.product.create({
      data: {
        name: p.name,
        unit: p.unit,
        isTarget: p.isTarget,
        targetQuantity: p.targetQuantity,
        category: p.category,
        sortOrder: p.sortOrder,
        isActive: true,
      },
    })
    createdProducts.push({ ...prod, defaultPrice: p.defaultPrice })
  }

  // 4. Create Members: 1 PJ and 3-4 members per sub-group
  const sampleData = [
    {
      subGroupIdx: 0,
      pj: { name: 'Ibu Siti Rahma', phone: '081234567801' },
      members: [
        { name: 'Pak Budi Santoso', phone: '081234567811' },
        { name: 'Ibu Ratna Sari', phone: '081234567812' },
        { name: 'Pak Joko Widodo', phone: '081234567813' },
        { name: 'Ibu Dewi Lestari', phone: '081234567814' },
      ],
    },
    {
      subGroupIdx: 1,
      pj: { name: 'Ibu Sri Wahyuni', phone: '081234567802' },
      members: [
        { name: 'Pak Hendra Pratama', phone: '081234567821' },
        { name: 'Ibu Nurul Hidayah', phone: '081234567822' },
        { name: 'Pak Ahmad Fauzi', phone: '081234567823' },
        { name: 'Ibu Rina Marlina', phone: '081234567824' },
      ],
    },
    {
      subGroupIdx: 2,
      pj: { name: 'Pak Agus Salim', phone: '081234567803' },
      members: [
        { name: 'Pak Dedi Mulyadi', phone: '081234567831' },
        { name: 'Ibu Siti Aminah', phone: '081234567832' },
        { name: 'Pak Bambang Irawan', phone: '081234567833' },
        { name: 'Ibu Endang Susilowati', phone: '081234567834' },
      ],
    },
    {
      subGroupIdx: 3,
      pj: { name: 'Ibu Wati Suherman', phone: '081234567804' },
      members: [
        { name: 'Pak Cecep Suryana', phone: '081234567841' },
        { name: 'Ibu Lina Kusuma', phone: '081234567842' },
        { name: 'Pak Anton Wijaya', phone: '081234567843' },
        { name: 'Ibu Yuli Astuti', phone: '081234567844' },
      ],
    },
    {
      subGroupIdx: 4,
      pj: { name: 'Pak Rudi Hartono', phone: '081234567805' },
      members: [
        { name: 'Pak Wahyu Hidayat', phone: '081234567851' },
        { name: 'Ibu Maya Septiana', phone: '081234567852' },
        { name: 'Pak Eko Prasetyo', phone: '081234567853' },
        { name: 'Ibu Anisa Fitri', phone: '081234567854' },
      ],
    },
  ]

  const allCreatedMembers = []

  for (const groupSet of sampleData) {
    const subGroup = createdSubGroups[groupSet.subGroupIdx]

    // Create PJ
    const pj = await prisma.member.create({
      data: {
        name: groupSet.pj.name,
        phone: groupSet.pj.phone,
        level: 2,
        groupId: subGroup.id,
        role: 'pj',
        isActive: true,
      },
    })
    allCreatedMembers.push(pj)

    // Update group's pjMemberId
    await prisma.group.update({
      where: { id: subGroup.id },
      data: { pjMemberId: pj.id },
    })

    // Create regular members
    for (const m of groupSet.members) {
      const createdMember = await prisma.member.create({
        data: {
          name: m.name,
          phone: m.phone,
          level: 1,
          groupId: subGroup.id,
          role: 'anggota',
          isActive: true,
        },
      })
      allCreatedMembers.push(createdMember)
    }
  }

  // 5. Create Initial Active Cycle
  const now = new Date()
  const periodStart = new Date(now)
  periodStart.setDate(now.getDate() - now.getDay() + 6) // Sabtu
  const orderDeadline = new Date(periodStart)
  orderDeadline.setDate(periodStart.getDate() + 3) // Selasa
  const deliveryDate = new Date(periodStart)
  deliveryDate.setDate(periodStart.getDate() + 5) // Kamis

  const currentCycle = await prisma.cycle.create({
    data: {
      label: 'Minggu 2 - Sep 2026',
      periodStart,
      orderDeadline,
      deliveryDate,
      status: 'open',
      notes: 'Siklus pembuka distribusi September. Target 20kg ayam dan 20 bungkus tahu.',
    },
  })

  // 6. Set Weekly Prices for Current Cycle
  for (const prod of createdProducts) {
    await prisma.weeklyPrice.create({
      data: {
        cycleId: currentCycle.id,
        productId: prod.id,
        price: prod.defaultPrice,
        consumerPrice: (prod as any).consumerPrice || prod.defaultPrice,
        traderPrice: (prod as any).traderPrice || prod.defaultPrice,
      },
    })
  }

  // 7. Assign Rotation Schedules (Batch 1: ~10 members scheduled)
  const scheduledMembers = allCreatedMembers.slice(0, 10)
  for (const mem of scheduledMembers) {
    await prisma.rotationSchedule.create({
      data: {
        cycleId: currentCycle.id,
        memberId: mem.id,
        status: 'scheduled',
      },
    })
  }

  // 8. Create a few initial orders to demonstrate data
  // Order 1: Pak Budi Santoso
  const order1 = await prisma.order.create({
    data: {
      cycleId: currentCycle.id,
      memberId: scheduledMembers[1].id,
      totalAmount: 113000,
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      paidAt: new Date(),
      notes: 'Ayam potong 8 bagian',
    },
  })

  const ayamProd = createdProducts.find((p) => p.name === 'Ayam Segar')!
  const tahuProd = createdProducts.find((p) => p.name === 'Tahu Segar')!
  const minyakProd = createdProducts.find((p) => p.name === 'Minyak Goreng 2L')!

  await prisma.orderItem.createMany({
    data: [
      {
        orderId: order1.id,
        productId: ayamProd.id,
        priceType: 'trader',
        quantity: 2,
        unitPrice: 35000,
        subtotal: 70000,
      },
      {
        orderId: order1.id,
        productId: tahuProd.id,
        priceType: 'consumer',
        quantity: 1,
        unitPrice: 8000,
        subtotal: 8000,
      },
      {
        orderId: order1.id,
        productId: minyakProd.id,
        priceType: 'consumer',
        quantity: 1,
        unitPrice: 34000,
        subtotal: 34000,
      },
    ],
  })

  // Order 2: Ibu Ratna Sari (Konsumen)
  const order2 = await prisma.order.create({
    data: {
      cycleId: currentCycle.id,
      memberId: scheduledMembers[2].id,
      totalAmount: 84000,
      paymentStatus: 'unpaid',
      orderStatus: 'pending',
      notes: null,
    },
  })

  await prisma.orderItem.createMany({
    data: [
      {
        orderId: order2.id,
        productId: ayamProd.id,
        priceType: 'consumer',
        quantity: 2,
        unitPrice: 38000,
        subtotal: 76000,
      },
      {
        orderId: order2.id,
        productId: tahuProd.id,
        priceType: 'consumer',
        quantity: 1,
        unitPrice: 8000,
        subtotal: 8000,
      },
    ],
  })

  // Mark rotation schedule for ordered members
  await prisma.rotationSchedule.updateMany({
    where: {
      cycleId: currentCycle.id,
      memberId: { in: [scheduledMembers[1].id, scheduledMembers[2].id] },
    },
    data: { status: 'ordered' },
  })

  console.log('✅ Seeding completed successfully!')
  console.log(`- Created ${createdSubGroups.length} sub-groups`)
  console.log(`- Created ${createdProducts.length} products`)
  console.log(`- Created ${allCreatedMembers.length} members`)
  console.log(`- Created 1 cycle with ${scheduledMembers.length} scheduled rotations and 2 demo orders`)
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
