import { api } from '@/services/api'

type DownloadParams = object | undefined

export async function downloadFile(url: string, filename: string, params?: DownloadParams) {
  const lang = typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en'
  const response = await api.get<Blob>(url, {
    params: {
      ...params,
      lang,
    },
    responseType: 'blob',
  })

  const blob = response.data instanceof Blob ? response.data : new Blob([response.data])
  const blobUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(blobUrl)
}
