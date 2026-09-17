'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Search,
  Sparkles,
  X,
  Filter,
  DollarSign,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface ProductItem {
  id: string
  name: string
  unit: string
  isTarget: boolean
  targetQuantity: number | null
  category: string | null
  sortOrder: number
  isActive: boolean
  consumerPrice: number | null
  traderPrice: number | null
  currentPrice: number | null
  activeCycleId: string | null
  activeCycleLabel: string | null
  _count?: {
    orderItems: number
  }
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form Fields
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [consumerPrice, setConsumerPrice] = useState<number | ''>('')
  const [traderPrice, setTraderPrice] = useState<number | ''>('')
  const [isTarget, setIsTarget] = useState(false)
  const [targetQuantity, setTargetQuantity] = useState<number | ''>('')
  const [category, setCategory] = useState('Sembako Pokok')
  const [sortOrder, setSortOrder] = useState<number>(0)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/products')
      const json = await res.json()
      setProducts(json)
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat katalog produk')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleOpenCreateModal = () => {
    setEditingProduct(null)
    setName('')
    setUnit('kg')
    setConsumerPrice('')
    setTraderPrice('')
    setIsTarget(false)
    setTargetQuantity('')
    setCategory('Sembako Pokok')
    setSortOrder(products.length + 1)
    setModalOpen(true)
  }

  const handleOpenEditModal = (p: ProductItem) => {
    setEditingProduct(p)
    setName(p.name)
    setUnit(p.unit)
    setConsumerPrice(p.consumerPrice ?? '')
    setTraderPrice(p.traderPrice ?? p.consumerPrice ?? '')
    setIsTarget(p.isTarget)
    setTargetQuantity(p.targetQuantity ?? '')
    setCategory(p.category ?? 'Sembako Pokok')
    setSortOrder(p.sortOrder)
    setModalOpen(true)
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)

      const payload = {
        name,
        unit,
        consumerPrice: consumerPrice === '' ? undefined : Number(consumerPrice),
        traderPrice: traderPrice === '' ? (consumerPrice === '' ? undefined : Number(consumerPrice)) : Number(traderPrice),
        isTarget,
        targetQuantity: isTarget && targetQuantity ? Number(targetQuantity) : null,
        category,
        sortOrder: Number(sortOrder) || 0,
      }

      if (editingProduct) {
        // Update (PATCH)
        const res = await fetch('/api/products', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingProduct.id,
            ...payload,
          }),
        })

        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Gagal mengubah produk')
        }

        toast.success(`Produk "${name}" & harga berhasil diperbarui!`)
      } else {
        // Create (POST)
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            isActive: true,
          }),
        })

        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Gagal menambahkan produk')
        }

        toast.success(`Produk "${name}" berhasil ditambahkan!`)
      }

      setModalOpen(false)
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (productId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId, isActive: !currentStatus }),
      })
      if (!res.ok) throw new Error('Gagal memperbarui status')
      toast.success(!currentStatus ? 'Produk diaktifkan' : 'Produk dinonaktifkan')
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message || 'Gagal update status')
    }
  }

  const handleDeleteProduct = async (p: ProductItem) => {
    const isUsed = (p._count?.orderItems || 0) > 0
    const confirmMessage = isUsed
      ? `Produk "${p.name}" sudah digunakan dalam riwayat pesanan. Menghapus akan menonaktifkannya dari siklus mendatang. Lanjutkan?`
      : `Apakah Anda yakin ingin menghapus produk "${p.name}" secara permanen?`

    if (!confirm(confirmMessage)) return

    try {
      const res = await fetch(`/api/products?id=${p.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus produk')

      toast.success(json.message || 'Produk berhasil dihapus')
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus produk')
    }
  }

  // Categories list for filter
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  ) as string[]

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !categoryFilter || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const activeCycle = products[0]?.activeCycleId
    ? { id: products[0].activeCycleId, label: products[0].activeCycleLabel }
    : null

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Command Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Katalog & Harga Produk</h1>
            <Badge variant="emerald" size="sm" className="tabular-nums font-bold">
              {products.length} Komoditas
            </Badge>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Kelola data komoditas sembako, penetapan Harga Konsumen & Pedagang per siklus, dan target kuota mingguan.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleOpenCreateModal}
          icon={<Plus className="w-4 h-4" />}
        >
          Tambah Produk Baru
        </Button>
      </div>

      {/* Active Cycle Quick Price Banner */}
      {activeCycle && (
        <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/60">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">
                Harga Siklus Aktif: {activeCycle.label}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik produk untuk mengubah Harga Konsumen & Pedagang, atau buka form batch untuk konfigurasi harga massal.
              </p>
            </div>
          </div>
          <Link
            href={`/cycles/${activeCycle.id}`}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-emerald-800 border border-slate-200/80 font-semibold px-3.5 py-2 rounded-xl text-xs transition-colors shrink-0 shadow-2xs self-start sm:self-auto"
          >
            Buka Form Batch Harga
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nama komoditas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-xl pl-9 pr-3 py-2 focus:outline-hidden focus:border-emerald-600"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600 cursor-pointer"
        >
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Tidak ada produk ditemukan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Nama Komoditas</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Satuan</th>
                  <th className="py-3 px-4">Harga Konsumen</th>
                  <th className="py-3 px-4">Harga Pedagang</th>
                  <th className="py-3 px-4">Target Mingguan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => handleOpenEditModal(p)}
                    className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                    title="Klik untuk melihat detail / mengedit produk & harga"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="hover:text-emerald-700 transition-colors">{p.name}</span>
                        {p.isTarget && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            Target Kuota
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">{p.category || '-'}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 font-semibold">{p.unit}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-xs tabular-nums">
                      {p.consumerPrice !== null ? formatCurrency(p.consumerPrice) : (
                        <span className="text-xs font-normal text-slate-500 italic">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-emerald-800 text-xs tabular-nums">
                      {p.traderPrice !== null ? (
                        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                          {formatCurrency(p.traderPrice)}
                        </span>
                      ) : (
                        <span className="text-xs font-normal text-slate-500 italic">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.isTarget ? (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md inline-block tabular-nums">
                          Min. {p.targetQuantity} {p.unit} / minggu
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleActive(p.id, p.isActive)
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                          p.isActive
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {p.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingProduct ? 'Edit Produk & Harga' : 'Tambah Produk Baru'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Komoditas
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Ayam Broiler Utuh"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Satuan
                  </label>
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="kg, bungkus, liter, dll"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Contoh: Daging, Sayur, Sembako"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Dual Pricing Fields */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Konsumen (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={consumerPrice}
                    onChange={(e) =>
                      setConsumerPrice(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="Contoh: 38000"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600 text-slate-900 bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Warga biasa</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Pedagang (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={traderPrice}
                    onChange={(e) =>
                      setTraderPrice(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="Contoh: 35000"
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600 text-emerald-800 bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Reseller / Warung</span>
                </div>
              </div>

              {/* Target Quota Setting */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={isTarget}
                    onChange={(e) => setIsTarget(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  Jadikan Produk Target Mingguan
                </label>

                {isTarget && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Jumlah Target Minimum per Siklus ({unit})
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required={isTarget}
                      value={targetQuantity}
                      onChange={(e) =>
                        setTargetQuantity(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="Contoh: 20"
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Target ini menggabungkan total pesanan konsumen maupun pedagang.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {editingProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteProduct(editingProduct)
                      setModalOpen(false)
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Produk
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 shadow-xs"
                  >
                    {submitting
                      ? 'Menyimpan...'
                      : editingProduct
                      ? 'Simpan Perubahan'
                      : 'Tambah Produk'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
