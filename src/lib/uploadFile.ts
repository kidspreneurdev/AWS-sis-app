import { supabase } from './supabase'

const BUCKET = 'uploads'

// Supabase Storage rejects keys with characters outside a safe ASCII set ("Invalid key")
// — macOS screenshot names, for one, put a narrow no-break space before "AM"/"PM". Keep
// folders as-is and reduce the file name to letters, digits, dot, dash and underscore.
function safeStoragePath(path: string): string {
  const slash = path.lastIndexOf('/')
  const dir = path.slice(0, slash + 1)
  const name = path.slice(slash + 1)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
  return dir + (name || 'file')
}

export async function uploadFile(path: string, file: File): Promise<string> {
  path = safeStoragePath(path)
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
