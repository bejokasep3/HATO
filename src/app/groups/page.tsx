'use client'

import React, { useEffect, useState } from 'react'
import {
  Building2,
  Users,
  PlusCircle,
  Phone,
  ShieldCheck,
  X,
  MessageSquare,
  Edit2,
  Trash2,
} from 'lucide-react'
import { getWhatsAppUrl } from '@/lib/utils'
import { toast } from 'sonner'

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

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupItem[]>([])
  const [allMembers, setAllMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null)
  const [name, setName] = useState('')
  const [pjMemberId, setPjMemberId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const fetchGroups = async () => {
    try {
      setLoading(true)
      const [groupsRes, membersRes] = await Promise.all([
        fetch('/api/groups'),
        fetch('/api/members'),
      ])
      const [groupsJson, membersJson] = await Promise.all([
        groupsRes.json(),
        membersRes.json(),
      ])
      setGroups(groupsJson)
      setAllMembers(membersJson)
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat sub-grup')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  const handleOpenCreateModal = () => {
    setEditingGroup(null)
    setName('')
    setPjMemberId('')
    setModalOpen(true)
  }

  const handleOpenEditModal = (g: GroupItem) => {
    setEditingGroup(g)
    setName(g.name)
    setPjMemberId(g.pjMemberId || '')
    setModalOpen(true)
  }

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)

      if (editingGroup) {
        // Update (PATCH)
        const res = await fetch('/api/groups', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingGroup.id,
            name,
            pjMemberId: pjMemberId || null,
          }),
        })

        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Gagal mengubah sub-grup')
        }

        toast.success(`Sub-grup "${name}" berhasil diperbarui!`)
      } else {
        // Create (POST)
        const res = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            level: 2,
            isActive: true,
            pjMemberId: pjMemberId || null,
          }),
        })

        if (!res.ok) {
          const errJson = await res.json()
          throw new Error(errJson.error || 'Gagal membuat sub-grup')
        }

        toast.success(`Sub-grup "${name}" berhasil dibuat!`)
      }

      setModalOpen(false)
      fetchGroups()
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
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
      fetchGroups()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus')
    }
  }

  const subGroups = groups.filter((g) => g.level === 2)
  const rootGroup = groups.find((g) => g.level === 3)

  // Members belonging to the currently edited group (all roles: anggota, pj, pengurus)
  const inGroupMembers = editingGroup
    ? allMembers.filter((m) => m.groupId === editingGroup.id)
    : []

  // Other community members
  const otherCommunityMembers = editingGroup
    ? allMembers.filter((m) => m.groupId !== editingGroup.id)
    : allMembers

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Sub-Grup</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola hierarki 5 sub-grup (Level 2), penugasan PJ per sub-grup, dan pemantauan jumlah anggota.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-all shadow-xs shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Tambah Sub-Grup Baru
        </button>
      </div>

      {rootGroup && (
        <div className="bg-emerald-800 text-white p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-emerald-200 font-semibold uppercase tracking-wider block">
                Level 3 (Pusat Distribusi Manajer)
              </span>
              <h2 className="text-lg font-bold">{rootGroup.name}</h2>
            </div>
          </div>
          <span className="text-xs bg-emerald-700/80 border border-emerald-600 px-3 py-1 rounded-full font-medium">
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
              onClick={() => handleOpenEditModal(g)}
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
                      {g.pjMember ? g.pjMember.name : (
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

      {/* CREATE / EDIT SUB-GROUP MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingGroup ? `Detail & Edit ${editingGroup.name}` : 'Tambah Sub-Grup Baru'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Sub-Grup Teratai"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Penanggung Jawab (PJ) Sub-Grup
                </label>
                <select
                  value={pjMemberId}
                  onChange={(e) => setPjMemberId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:border-emerald-600"
                >
                  <option value="">-- Belum Ditentukan --</option>

                  {inGroupMembers.length > 0 && (
                    <optgroup label={`Semua dalam ${editingGroup?.name || 'Sub-Grup Ini'} (${inGroupMembers.length} orang)`}>
                      {inGroupMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.phone}) — {m.role === 'pj' ? '⭐ PJ' : m.role === 'pengurus' ? '🛡️ Pengurus' : '👤 Anggota'}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {otherCommunityMembers.length > 0 && (
                    <optgroup
                      label={
                        inGroupMembers.length > 0
                          ? 'Anggota Komunitas Lainnya'
                          : 'Pilih dari Anggota Komunitas'
                      }
                    >
                      {otherCommunityMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.phone}) [{m.group?.name || 'Tanpa Grup'}] —{' '}
                          {m.role === 'pj' ? 'PJ' : m.role === 'pengurus' ? 'Pengurus' : 'Anggota'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Semua orang dalam sub-grup ini (baik Anggota Biasa, PJ, maupun Pengurus) dapat dipilih sebagai PJ.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {editingGroup ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteGroup(editingGroup)
                      setModalOpen(false)
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Sub-Grup
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
                      : editingGroup
                      ? 'Simpan Perubahan'
                      : 'Simpan Sub-Grup'}
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
