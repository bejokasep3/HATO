'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Plus,
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
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

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

interface GroupItem {
  id: string
  name: string
  level: number
  pjMemberId?: string | null
  pjMember?: {
    id: string
    name: string
    phone: string
  } | null
  members?: Array<{
    id: string
    name: string
    phone: string
    role: string
  }>
  _count?: {
    members: number
  }
}

export default function CommunityPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'members' | 'groups'>('members')
  const [loading, setLoading] = useState(true)

  // Members state
  const [members, setMembers] = useState<MemberItem[]>([])
  const [allMembers, setAllMembers] = useState<MemberItem[]>([])
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  // Groups state
  const [groups, setGroups] = useState<GroupItem[]>([])

  // Member modal state
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null)
  const [memberSubmitting, setMemberSubmitting] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberPhone, setMemberPhone] = useState('')
  const [memberGroupId, setMemberGroupId] = useState('')
  const [memberRole, setMemberRole] = useState('anggota')
  const [memberLevel, setMemberLevel] = useState(1)

  // Group modal state
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null)
  const [groupName, setGroupName] = useState('')
  const [groupPjMemberId, setGroupPjMemberId] = useState('')
  const [groupSubmitting, setGroupSubmitting] = useState(false)

  // Initialize active tab from URL query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab')
      if (tabParam === 'groups' || tabParam === 'members') {
        setActiveTab(tabParam)
      }
    }
  }, [])

  const handleTabChange = (tab: 'members' | 'groups') => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', tab)
      window.history.replaceState({}, '', url.toString())
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      if (search) queryParams.set('search', search)
      if (selectedGroup) queryParams.set('groupId', selectedGroup)

      const [membersRes, allMembersRes, groupsRes] = await Promise.all([
        fetch(`/api/members?${queryParams.toString()}`),
        fetch('/api/members'),
        fetch('/api/groups'),
      ])

      const [membersJson, allMembersJson, groupsJson] = await Promise.all([
        membersRes.json(),
        allMembersRes.json(),
        groupsRes.json(),
      ])

      setMembers(membersJson || [])
      setAllMembers(allMembersJson || [])
      setGroups(groupsJson || [])

      if (groupsJson.length > 0 && !memberGroupId) {
        setMemberGroupId(groupsJson[0].id)
      }
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat data komunitas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [search, selectedGroup])

  // Member CRUD handlers
  const handleOpenCreateMemberModal = () => {
    setEditingMember(null)
    setMemberName('')
    setMemberPhone('')
    setMemberRole('anggota')
    setMemberLevel(1)
    if (groups.length > 0) setMemberGroupId(groups[0].id)
    setMemberModalOpen(true)
  }

  const handleOpenEditMemberModal = (m: MemberItem) => {
    setEditingMember(m)
    setMemberName(m.name)
    setMemberPhone(m.phone)
    setMemberGroupId(m.groupId)
    setMemberRole(m.role)
    setMemberLevel(m.level)
    setMemberModalOpen(true)
  }

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setMemberSubmitting(true)
      const payload = {
        name: memberName,
        phone: memberPhone,
        groupId: memberGroupId,
        role: memberRole,
        level: Number(memberLevel),
      }

      if (editingMember) {
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

        toast.success(`Data anggota "${memberName}" berhasil diperbarui!`)
      } else {
        const res = await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Gagal menambahkan anggota')
        }

        toast.success(`Anggota baru "${memberName}" berhasil didaftarkan!`)
      }

      setMemberModalOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan')
    } finally {
      setMemberSubmitting(false)
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch('/api/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          isActive: !currentActive,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Gagal mengubah status aktif')
      }

      toast.success(currentActive ? 'Anggota dinonaktifkan' : 'Anggota diaktifkan kembali')
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

  // Group CRUD handlers
  const handleOpenCreateGroupModal = () => {
    setEditingGroup(null)
    setGroupName('')
    setGroupPjMemberId('')
    setGroupModalOpen(true)
  }

  const handleOpenEditGroupModal = (g: GroupItem) => {
    setEditingGroup(g)
    setGroupName(g.name)
    setGroupPjMemberId(g.pjMemberId || '')
    setGroupModalOpen(true)
  }

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setGroupSubmitting(true)
      if (editingGroup) {
        const res = await fetch('/api/groups', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingGroup.id,
            name: groupName,
            pjMemberId: groupPjMemberId || null,
          }),
        })

        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Gagal mengubah sub-grup')
        }

        toast.success(`Sub-grup "${groupName}" berhasil diperbarui!`)
      } else {
        const res = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: groupName,
            level: 2,
            isActive: true,
            pjMemberId: groupPjMemberId || null,
          }),
        })

        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Gagal membuat sub-grup')
        }

        toast.success(`Sub-grup "${groupName}" berhasil dibuat!`)
      }

      setGroupModalOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan')
    } finally {
      setGroupSubmitting(false)
    }
  }

  const handleDeleteGroup = async (g: GroupItem) => {
    const memberCount = g._count?.members || 0
    if (memberCount > 0) {
      toast.error(`Tidak dapat menghapus "${g.name}" karena masih ada ${memberCount} anggota di dalamnya.`)
      return
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus sub-grup "${g.name}"?`)) return

    try {
      const res = await fetch(`/api/groups?id=${g.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus sub-grup')

      toast.success(json.message || 'Sub-grup berhasil dihapus')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus')
    }
  }

  const filteredMembers = members.filter((m) => {
    return !roleFilter || m.role === roleFilter
  })

  const subGroups = groups.filter((g) => g.level === 2)
  const rootGroup = groups.find((g) => g.level === 3)

  const inGroupMembers = editingGroup
    ? allMembers.filter((m) => m.groupId === editingGroup.id)
    : []

  const otherCommunityMembers = editingGroup
    ? allMembers.filter((m) => m.groupId !== editingGroup.id)
    : allMembers

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Command Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Komunitas & Struktur Grup</h1>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 tabular-nums">
              {members.length} Anggota • {subGroups.length} Sub-Grup
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Kelola data anggota komunitas (Level 1), penanggung jawab Sub-Grup (Level 2), dan koordinasi distribusi.
          </p>
        </div>

        <div>
          {activeTab === 'members' ? (
            <Button
              variant="primary"
              onClick={handleOpenCreateMemberModal}
              icon={<Plus className="w-4 h-4" />}
            >
              Tambah Anggota Baru
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleOpenCreateGroupModal}
              icon={<Plus className="w-4 h-4" />}
            >
              Tambah Sub-Grup Baru
            </Button>
          )}
        </div>
      </div>

      {/* Tactile Segmented Tab Switcher */}
      <div className="inline-flex bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 gap-1 overflow-x-auto w-full sm:w-auto">
        <button
          onClick={() => handleTabChange('members')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'members'
              ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Daftar Anggota ({members.length})
        </button>
        <button
          onClick={() => handleTabChange('groups')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'groups'
              ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Struktur Sub-Grup & PJ ({subGroups.length})
        </button>
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
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
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600 cursor-pointer"
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
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600 cursor-pointer"
            >
              <option value="">Semua Peran</option>
              <option value="pj">PJ Sub-Grup</option>
              <option value="anggota">Anggota Biasa</option>
              <option value="pengurus">Pengurus</option>
            </select>
          </div>

          {/* Members Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
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
                        onClick={() => handleOpenEditMemberModal(m)}
                        className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                        title="Klik untuk melihat detail / mengedit data anggota"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center font-bold text-[11px] text-slate-700 shrink-0">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="hover:text-emerald-700 transition-colors">{m.name}</span>
                          </div>
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
                            {m.role === 'pj' ? 'PJ Sub-Grup (L2)' : m.role === 'pengurus' ? 'Pengurus (L3)' : 'Anggota (L1)'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 tabular-nums">
                          {m._count?.orders || 0} kali
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleActive(m.id, m.isActive)
                            }}
                            className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
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
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg transition-colors cursor-pointer"
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
        </div>
      )}

      {/* TAB 2: GROUPS */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {rootGroup && (
            <div className="bg-emerald-900 border border-emerald-800 text-white p-5 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center text-white border border-emerald-700/60">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-white tracking-tight">{rootGroup.name}</h2>
                    <span className="text-[11px] font-semibold text-emerald-200 bg-emerald-800/80 px-2 py-0.5 rounded border border-emerald-700/50">
                      Grup Manajer (L3)
                    </span>
                  </div>
                  <p className="text-xs text-emerald-100/70 mt-0.5">Pusat koordinasi rekapitulasi ke Supplier Level 4</p>
                </div>
              </div>
              <span className="text-xs bg-emerald-800/80 border border-emerald-700 px-3 py-1 rounded-full font-medium tabular-nums">
                {subGroups.length} Sub-Grup Terkoordinasi
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center min-h-[30vh]">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {subGroups.map((g) => (
                <div
                  key={g.id}
                  onClick={() => handleOpenEditGroupModal(g)}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
                  title="Klik untuk melihat detail / mengedit sub-grup & PJ"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          L2
                        </div>
                        <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-700 transition-colors">
                          {g.name}
                        </h3>
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full">
                        Detail & Edit
                      </span>
                    </div>

                    <div className="space-y-2.5 py-3 border-y border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Penanggung Jawab (PJ):</span>
                        <span className="font-bold text-slate-800 text-sm">
                          {g.pjMember ? (
                            g.pjMember.name
                          ) : (
                            <span className="text-slate-400 font-normal italic">Belum ditetapkan</span>
                          )}
                        </span>
                      </div>
                      {g.pjMember && (
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-slate-500 text-[11px]">Kontak WhatsApp:</span>
                          <a
                            href={getWhatsAppUrl(g.pjMember.phone, `Halo ${g.pjMember.name} (PJ ${g.name}):`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-emerald-700 hover:underline inline-flex items-center gap-1 font-semibold text-xs bg-emerald-50 px-2 py-0.5 rounded"
                          >
                            <MessageSquare className="w-3 h-3" />
                            {g.pjMember.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <strong>{g._count?.members || 0}</strong> Anggota Terdaftar
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Aktif
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT MEMBER MODAL */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingMember ? 'Edit Data Anggota' : 'Tambah Anggota Baru'}
              </h2>
              <button
                onClick={() => setMemberModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
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
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
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
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub-Grup (Level 2)
                </label>
                <select
                  value={memberGroupId}
                  onChange={(e) => setMemberGroupId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} (Level {g.level})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Peran Komunitas
                  </label>
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="anggota">Anggota Biasa</option>
                    <option value="pj">PJ Sub-Grup</option>
                    <option value="pengurus">Pengurus</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Level Hirarki
                  </label>
                  <select
                    value={memberLevel}
                    onChange={(e) => setMemberLevel(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                  >
                    <option value={1}>Level 1 (Anggota)</option>
                    <option value={2}>Level 2 (PJ Sub-Grup)</option>
                    <option value={3}>Level 3 (Manajer)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                {editingMember ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(editingMember)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1.5 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMemberModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={memberSubmitting}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {memberSubmitting
                      ? 'Menyimpan...'
                      : editingMember
                      ? 'Simpan Perubahan'
                      : 'Tambahkan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SUB-GROUP MODAL */}
      {groupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingGroup ? `Detail & Edit ${editingGroup.name}` : 'Tambah Sub-Grup Baru'}
              </h2>
              <button
                onClick={() => setGroupModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Sub-Grup
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Contoh: Sub-Grup Mawar"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Penanggung Jawab (PJ Sub-Grup)
                </label>
                <select
                  value={groupPjMemberId}
                  onChange={(e) => setGroupPjMemberId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                >
                  <option value="">-- Belum Ditetapkan --</option>
                  {inGroupMembers.length > 0 && (
                    <optgroup label={`Anggota ${editingGroup?.name || 'Sub-Grup Ini'}`}>
                      {inGroupMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.phone}) {m.role === 'pj' ? '⭐ (PJ Saat Ini)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Anggota Komunitas Lainnya">
                    {otherCommunityMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.phone})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  PJ bertugas merekap pesanan anggotanya dan meneruskan ke Manajer.
                </p>
              </div>

              {editingGroup && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-700 block mb-1">
                    Anggota Terdaftar di Sub-Grup Ini:
                  </span>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {inGroupMembers.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Belum ada anggota.</span>
                    ) : (
                      inGroupMembers.map((m) => (
                        <div
                          key={m.id}
                          className="text-xs flex items-center justify-between text-slate-600 bg-white px-2 py-1 rounded border border-slate-200/60"
                        >
                          <span>{m.name}</span>
                          <span className="text-[10px] text-slate-400">{m.role}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                {editingGroup ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(editingGroup)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1.5 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={groupSubmitting}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {groupSubmitting
                      ? 'Menyimpan...'
                      : editingGroup
                      ? 'Simpan Perubahan'
                      : 'Buat Sub-Grup'}
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
