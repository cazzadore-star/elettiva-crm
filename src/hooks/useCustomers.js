import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEY = 'customers'

export function useCustomers({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: [KEY, includeInactive],
    queryFn: async () => {
      let q = supabase
        .from('customers')
        .select('*')
        .order('company_name', { ascending: true })
      if (!includeInactive) q = q.eq('active', true)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useUpsertCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (customer) => {
      const { data, error } = customer.id
        ? await supabase.from('customers').update({
            company_name: customer.company_name,
            active: customer.active,
          }).eq('id', customer.id).select().single()
        : await supabase.from('customers').insert({
            company_name: customer.company_name,
          }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useToggleCustomerActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active }) => {
      const { error } = await supabase
        .from('customers')
        .update({ active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
