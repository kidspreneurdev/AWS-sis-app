import html2canvas from 'html2canvas'

export async function downloadCertificateImage(node: HTMLElement, fileName: string) {
  if (document.fonts?.ready) await document.fonts.ready

  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
  })

  const dataUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}
