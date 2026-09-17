'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function GroupsRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/members?tab=groups')
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      <p className="text-sm text-slate-500 font-medium">
        Membuka Struktur Sub-Grup di Komunitas...
      </p>
    </div>
  )
}
