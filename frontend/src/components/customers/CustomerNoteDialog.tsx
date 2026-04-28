import { useState, memo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Edit2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { customerService } from '@/services/customer.service'
import type { CustomerNote } from '@/types/customer.types'

interface CustomerNoteDialogProps {
  isOpen: boolean
  onClose: () => void
  customerId: number
}

// Memoized note item component for better performance
const NoteItem = memo(function NoteItem({
  note,
  isEditing,
  editingNoteId,
  editText,
  setEditText,
  setIsEditing,
  setEditingNoteId,
  updateNoteMutation,
  deleteNoteMutation,
  isBusy,
  t,
}: {
  note: CustomerNote
  isEditing: boolean
  editingNoteId: number | null
  editText: string
  setEditText: (text: string) => void
  setIsEditing: (editing: boolean) => void
  setEditingNoteId: (id: number | null) => void
  updateNoteMutation: any
  deleteNoteMutation: any
  isBusy: boolean
  t: any
}) {
  return (
    <div
      key={note.id}
      className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40"
    >
      {isEditing && editingNoteId === note.id ? (
        <div className="space-y-2">
          <textarea
            value={editText}
            onChange={(event) => setEditText(event.target.value)}
            maxLength={5000}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            disabled={isBusy}
          />
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsEditing(false)
                setEditingNoteId(null)
                setEditText('')
              }}
              disabled={isBusy}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => updateNoteMutation.mutate()}
              disabled={!editText.trim() || isBusy}
            >
              {updateNoteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : null}
              {t('common.save', { defaultValue: 'Save' })}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{note.note}</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(true)
                  setEditingNoteId(note.id)
                  setEditText(note.note)
                }}
                disabled={isBusy || note.id < 0} // Disable for optimistic notes
                className="h-7 w-7 p-0"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (note.id < 0) {
                    // Can't delete optimistic notes that haven't been saved yet
                    return
                  }
                  deleteNoteMutation.mutate(note.id)
                }}
                disabled={isBusy || note.id < 0} // Disable for optimistic notes
                className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 dark:text-rose-400"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
})

function CustomerNoteDialogComponent({ isOpen, onClose, customerId }: CustomerNoteDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [newNoteText, setNewNoteText] = useState('')
  const [editText, setEditText] = useState('')

  // Fetch customer's notes (only their own) with aggressive caching
  const notesQuery = useQuery({
    queryKey: ['customer-notes', customerId],
    queryFn: () => customerService.getMyNotes(customerId),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })

  // Add note mutation with optimistic update
  const addNoteMutation = useMutation({
    mutationFn: () => customerService.addNote(customerId, newNoteText.trim()),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['customer-notes', customerId] })
      const previousNotes = queryClient.getQueryData(['customer-notes', customerId])

      const optimisticNote = {
        id: -Date.now(), // Use negative ID to identify as optimistic
        customer_id: customerId,
        user_id: 0,
        note: newNoteText.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      queryClient.setQueryData(['customer-notes', customerId], (old: any) => ({
        ...old,
        data: [optimisticNote, ...(old?.data ?? [])],
      }))

      return previousNotes
    },
    onSuccess: (data) => {
      setNewNoteText('')
      // Update cache with real note data from server
      queryClient.setQueryData(['customer-notes', customerId], (old: any) => ({
        ...old,
        data: [
          ...(old?.data?.filter((n: any) => n.id && n.id > 0) ?? []),
          data.data
        ],
      }))
      toast.success(t('common.noteSaved', { defaultValue: 'Note added successfully.' }))
    },
    onError: (err: any, _variables, context) => {
      if (context) {
        queryClient.setQueryData(['customer-notes', customerId], context)
      }
      const errorMessage = err?.response?.data?.message ||
                          err?.message ||
                          t('common.error', { defaultValue: 'Failed to add note' })
      console.error('Add note error:', { err, errorMessage })
      toast.error(errorMessage)
    },
  })

  // Update note mutation with optimistic update
  const updateNoteMutation = useMutation({
    mutationFn: () => {
      if (!editingNoteId) throw new Error('No note selected')
      return customerService.updateNote(editingNoteId, editText.trim())
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['customer-notes', customerId] })
      const previousNotes = queryClient.getQueryData(['customer-notes', customerId])

      queryClient.setQueryData(['customer-notes', customerId], (old: any) => ({
        ...old,
        data: (old?.data ?? []).map((note: CustomerNote) =>
          note.id === editingNoteId ? { ...note, note: editText.trim() } : note
        ),
      }))

      return previousNotes
    },
    onSuccess: () => {
      setIsEditing(false)
      setEditingNoteId(null)
      setEditText('')
      toast.success(t('common.noteUpdated', { defaultValue: 'Note updated successfully.' }))
      void queryClient.invalidateQueries({ queryKey: ['customer-notes', customerId] })
    },
    onError: (_err, _variables, context) => {
      if (context) {
        queryClient.setQueryData(['customer-notes', customerId], context)
      }
      toast.error(t('common.error', { defaultValue: 'Failed to update note' }))
    },
  })

  // Delete note mutation with optimistic update
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) => {
      if (noteId < 0) {
        return Promise.reject(new Error('Cannot delete unsaved notes'))
      }
      return customerService.deleteNote(noteId)
    },
    onMutate: async (noteId) => {
      await queryClient.cancelQueries({ queryKey: ['customer-notes', customerId] })
      const previousNotes = queryClient.getQueryData(['customer-notes', customerId])

      queryClient.setQueryData(['customer-notes', customerId], (old: any) => ({
        ...old,
        data: (old?.data ?? []).filter((note: CustomerNote) => note.id !== noteId),
      }))

      return { previousNotes, noteId }
    },
    onSuccess: () => {
      toast.success(t('common.noteDeleted', { defaultValue: 'Note deleted successfully.' }))
    },
    onError: (err: any, _noteId, context: any) => {
      // If deletion returns 404, the note might already be deleted on server
      // Just keep the optimistic update (don't rollback)
      if (err?.response?.status === 404) {
        // Note is actually deleted, just show success
        toast.success(t('common.noteDeleted', { defaultValue: 'Note deleted successfully.' }))
        return
      }

      // For other errors, rollback the optimistic update
      if (context?.previousNotes) {
        queryClient.setQueryData(['customer-notes', customerId], context.previousNotes)
      }

      const errorMessage = err?.response?.data?.message ||
                          err?.message ||
                          t('common.error', { defaultValue: 'Failed to delete note' })
      toast.error(errorMessage)
    },
  })

  const notes = notesQuery.data?.data ?? []
  const isBusy = addNoteMutation.isPending || updateNoteMutation.isPending || deleteNoteMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('common.notes', { defaultValue: 'Notes' })}</DialogTitle>
          <DialogDescription>
            {t('common.notesDesc', { defaultValue: 'Your private notes for this customer. Only you can see your notes.' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new note */}
          {!isEditing && (
            <div className="space-y-2">
              <textarea
                value={newNoteText}
                onChange={(event) => setNewNoteText(event.target.value)}
                placeholder={t('common.noteNewPlaceholder', { defaultValue: 'Add a new note...' })}
                maxLength={5000}
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                disabled={isBusy}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => addNoteMutation.mutate()}
                disabled={!newNoteText.trim() || isBusy}
              >
                {addNoteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin me-2" />
                ) : null}
                {t('common.add', { defaultValue: 'Add' })}
              </Button>
            </div>
          )}

          {/* Notes list */}
          <div className="space-y-3">
            {notesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading', { defaultValue: 'Loading...' })}
              </div>
            ) : notes.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('common.noNotes', { defaultValue: 'No notes yet. Add one to get started.' })}
              </p>
            ) : (
              notes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  isEditing={isEditing}
                  editingNoteId={editingNoteId}
                  editText={editText}
                  setEditText={setEditText}
                  setIsEditing={setIsEditing}
                  setEditingNoteId={setEditingNoteId}
                  updateNoteMutation={updateNoteMutation}
                  deleteNoteMutation={deleteNoteMutation}
                  isBusy={isBusy}
                  t={t}
                />
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Memoize the entire dialog component to prevent unnecessary re-renders
export const CustomerNoteDialog = memo(CustomerNoteDialogComponent)
