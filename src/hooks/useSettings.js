import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEY = 'settings'

export function useSettings() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ period_start, period_end, default_rotation }) => {
      const { data, error } = await supabase
        .from('settings')
        .update({ period_start, period_end, default_rotation })
        .eq('id', 1)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
