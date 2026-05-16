import { supabase } from './supabase'

const BUCKET = 'uploads'

export async function uploadFile(path: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function fileNameFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').pop() ?? 'download'
    // Strip leading timestamp prefix like "1715000000000_report.pdf" → "report.pdf"
    return last.replace(/^\d+_/, '') || 'download'
  } catch {
    return 'download'
  }
}

export async function downloadUrl(url: string, filename?: string): Promise<void> {
  const name = filename ?? fileNameFromUrl(url)
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}
