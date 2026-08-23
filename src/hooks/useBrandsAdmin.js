import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useAddBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name) => {
      const { data, error } = await supabase
        .from('brands')
        .insert({ name: name.trim() })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  })
}

export function useToggleBrandActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active }) => {
      const { error } = await supabase
        .from('brands')
        .update({ active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  })
}
