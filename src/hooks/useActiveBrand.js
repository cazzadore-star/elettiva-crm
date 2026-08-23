import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

// Brand attivo salvato in localStorage (per-browser, non condiviso tra utenti)
export function useActiveBrand() {
  const { data: brands = [] } = useBrands()
  const [activeBrandId, setActiveBrandIdState] = useState(() => {
    const stored = localStorage.getItem('active_brand_id')
    return stored ? Number(stored) : null
  })

  // Se non c'è ancora un brand selezionato e i brand sono caricati, seleziona il primo
  useEffect(() => {
    if (!activeBrandId && brands.length > 0) {
      setActiveBrandIdState(brands[0].id)
      localStorage.setItem('active_brand_id', String(brands[0].id))
    }
  }, [activeBrandId, brands])

  function setActiveBrandId(id) {
    setActiveBrandIdState(id)
    localStorage.setItem('active_brand_id', String(id))
  }

  const activeBrand = brands.find(b => b.id === activeBrandId) || null

  return { activeBrandId, activeBrand, setActiveBrandId, brands }
}
