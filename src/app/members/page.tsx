'use client'

import React, { useEffect, useState } from 'react'
import {
  Users,
  PlusCircle,
  Search,
  MessageSquare,
  X,
  Phone,
  Building2,
  ShieldCheck,
  Edit2,
  Trash2,
  Filter,
} from 'lucide-react'
import { getWhatsAppUrl } from '@/lib/utils'
import { toast } from 'sonner'

interface MemberItem {
  id: string
  name: string
  phone: string
  level: number
  groupId: string
  role: string
  isActive: boolean
  group?: {
    id: string
    name: string
  }
  _count?: {
    orders: number
  }
}

export default function MembersPage() {
  const [members, setMembers] = useState<MemberItem[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  // Create & Edit Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form Fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [groupId, setGroupId] = useState('')
  const [role, setRole] = useState('anggota')
  const [level, setLevel] = useState(1)

  const fetchData = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      if (search) queryParams.set('search', search)
      if (selectedGroup) queryParams.set('groupId', selectedGroup)

      const [membersRes, groupsRes] = await Promise.all([
        fetch(`/api/members?${queryParams.toString()}`),
        fetch('/api/groups'),
      ])

      const [membersJson, groupsJson] = await Promise.all([
        membersRes.json(),
        groupsRes.json(),
      ])

      setMembers(membersJson)
      setGroups(groupsJson)
      if (groupsJson.length > 0 && !groupId) {
        setGroupId(groupsJson[0].id)
      }
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat data anggota')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [search, selectedGroup])

  const handleOpenCreateModal = () => {
    setEditingMember(null)
    setName('')
    setPhone('')
    setRole('anggota')
    setLevel(1)
    if (groups.length > 0) setGroupId(groups[0].id)
    setModalOpen(true)
  }

  const handleOpenEditModal = (m: MemberItem) => {
    setEditingMember(m)
    setName(m.name)
    setPhone(m.phone)
    setGroupId(m.groupId)
    setRole(m.role)
    setLevel(m.level)
    setModalOpen(true)
  }

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)

      const payload = {
        name,
        phone,
        groupId,
        role,
        level: Number(level),
      }

      if (editingMember) {
        // Update (PATCH)
        const res = await fetch('/api/members', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingMember.id,
            ...payload,
          }),
        })

        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Gagal mengubah anggota')
        }

        toast.success(`Data anggota "${name}" berhasil diperbarui!`)
      } else {
        // Create (POST)
        const res = await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            isActive: true,
          }),
        })

        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Gagal menambahkan anggota')
        }

        toast.success(`Anggota baru "${name}" berhasil ditambahkan!`)
      }

      setModalOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (memberId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberId, isActive: !currentStatus }),
      })
      if (!res.ok) throw new Error('Gagal memperbarui status')
      toast.success(!currentStatus ? 'Anggota diaktifkan' : 'Anggota dinonaktifkan')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal update status')
    }
  }

  const handleDeleteMember = async (m: MemberItem) => {
    const isUsed = (m._count?.orders || 0) > 0
    const confirmMessage = isUsed
      ? `Anggota "${m.name}" sudah memiliki riwayat transaksi pesanan. Menghapus akan menonaktifkannya dari siklus mendatang. Lanjutkan?`
      : `Apakah Anda yakin ingin menghapus data anggota "${m.name}" secara permanen?`

    if (!confirm(confirmMessage)) return

    try {
      const res = await fetch(`/api/members?id=${m.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus anggota')

      toast.success(json.message || 'Anggota berhasil dihapus')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus anggota')
    }
  }

  const filteredMembers = members.filter((m) => {
    return !roleFilter || m.role === roleFilter
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Anggota</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola data anggota komunitas (Level 1), penanggung jawab (PJ Level 2), dan kontak WhatsApp.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-all shadow-xs shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Tambah Anggota Baru
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nama atau nomor HP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:outline-hidden focus:border-emerald-600"
          />
        </div>

        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600"
        >
          <option value="">Semua Sub-Grup</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600"
        >
          <option value="">Semua Peran</option>
          <option value="pj">PJ Sub-Grup</option>
          <option value="anggota">Anggota Biasa</option>
          <option value="pengurus">Pengurus</option>
        </select>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Tidak ada data anggota ditemukan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Sub-Grup</th>
                  <th className="py-3 px-4">Role / Level</th>
                  <th className="py-3 px-4">Total Order</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Kontak WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => handleOpenEditModal(m)}
                    className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                    title="Klik untuk melihat detail / mengedit data anggota"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <span className="hover:text-emerald-700 transition-colors">{m.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">{m.group?.name || '-'}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          m.role === 'pj'
                            ? 'bg-purple-100 text-purple-800'
                            : m.role === 'pengurus'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {m.role === 'pj' && <ShieldCheck className="w-3.5 h-3.5" />}
                        {m.role.toUpperCase()} (L{m.level})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                      {m._count?.orders || 0} kali
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleActive(m.id, m.isActive)
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                          m.isActive
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {m.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={getWhatsAppUrl(m.phone, `Halo ${m.name}:`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        {m.phone}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MEMBER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingMember ? 'Edit Data Anggota' : 'Tambah Anggota Baru'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Ibu Rina Marlina"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub-Grup (Level 2)
                </label>
                <select
                  required
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Peran</label>
                  <select
                    value={role}
                    onChange={(e) => {
                      const newRole = e.target.value
                      setRole(newRole)
                      if (newRole === 'pj') setLevel(2)
                      else if (newRole === 'pengurus') setLevel(3)
                      else setLevel(1)
                    }}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600"
                  >
                    <option value="anggota">Anggota Biasa</option>
                    <option value="pj">PJ Sub-Grup</option>
                    <option value="pengurus">Pengurus</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600"
                  >
                    <option value={1}>Level 1 (Anggota)</option>
                    <option value={2}>Level 2 (PJ Sub-grup)</option>
                    <option value={3}>Level 3 (Manajer)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {editingMember ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteMember(editingMember)
                      setModalOpen(false)
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Anggota
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
                      : editingMember
                      ? 'Simpan Perubahan'
                      : 'Tambah Anggota'}
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
