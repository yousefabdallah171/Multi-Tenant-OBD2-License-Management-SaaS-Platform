import { api } from '@/services/api'

type DownloadParams = object | undefined

interface ExportTaskResponse {
  export_id: string
  status: string
}

interface ExportTaskStatus {
  data: {
    id: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    filename: string
    download_url: string | null
    error: string | null
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pollExportTask(exportId: string): Promise<ExportTaskStatus['data']> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const { data } = await api.get<ExportTaskStatus>(`/exports/${exportId}`)
    if (data.data.status === 'completed') {
      return data.data
    }

    if (data.data.status === 'failed') {
      throw new Error(data.data.error ?? 'Export failed')
    }

    await sleep(1500)
  }

  throw new Error('Export timed out')
}

function saveBlob(blob: Blob, filename: string) {
  const blobUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(blobUrl)
}

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
  const contentType = String(response.headers['content-type'] ?? '')

  if (contentType.includes('application/json')) {
    const payload = JSON.parse(await blob.text()) as ExportTaskResponse
    if (payload.export_id) {
      const task = await pollExportTask(payload.export_id)
      if (!task.download_url) {
        throw new Error('Export completed without a download URL')
      }

      const downloadResponse = await api.get<Blob>(task.download_url, { responseType: 'blob' })
      const downloadBlob = downloadResponse.data instanceof Blob ? downloadResponse.data : new Blob([downloadResponse.data])
      saveBlob(downloadBlob, task.filename || filename)
      return
    }
  }

  saveBlob(blob, filename)
}
