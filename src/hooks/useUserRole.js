import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useUserRole() {
  return useQuery({
    queryKey: ['user_role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
      if (error) return 'operator' // default sicuro
      return data.role
    },
  })
}

export function useIsAdmin() {
  const { data: role, isLoading } = useUserRole()
  if (isLoading) return false
  return role === 'admin'
}

export function useIsVisitor() {
  const { data: role, isLoading } = useUserRole()
  if (isLoading) return false
  return role === 'visitor'
}

// true se l'utente può modificare/creare/eliminare dati (admin o operator)
export function useCanEdit() {
  const { data: role, isLoading } = useUserRole()
  if (isLoading) return false
  return role === 'admin' || role === 'operator'
}
