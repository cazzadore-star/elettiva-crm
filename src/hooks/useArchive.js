import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEY = 'forecast_archives'

export function useArchives() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_archives')
        .select('id, name, year, period_start, period_end, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

// Crea un archivio prendendo i dati del forecast per il range di mesi/anni indicato
export function useCreateArchive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, periodStart, periodEnd, startYear, rows }) => {
      const { data, error } = await supabase
        .from('forecast_archives')
        .insert({
          name,
          year: startYear,
          period_start: periodStart,
          period_end:   periodEnd,
          data:         rows,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteArchive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('forecast_archives')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useArchiveDetail(id) {
  return useQuery({
    queryKey: [KEY, id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_archives')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}