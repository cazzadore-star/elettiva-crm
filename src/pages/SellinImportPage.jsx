import { useState, useMemo } from 'react'
import { Upload, ArrowRight, ArrowLeft, Check, AlertTriangle, Plus } from 'lucide-react'
import { useCustomers, useUpsertCustomer } from '../hooks/useCustomers'
import { useProducts, useCreateProductsBulk } from '../hooks/useProducts'
import { useBrands } from '../hooks/useActiveBrand'
import { useCustomerMappings, useFinalizeSellinImport } from '../hooks/useSellin'
import PageHeader from '../components/ui/PageHeader'
import { useNavigate } from 'react-router-dom'

const STEPS = ['Carica file', 'Clienti', 'Prodotti', 'Mesi e punti vendita', 'Conferma']

function normalize(s) {
  return (s || '').toString().trim().toUpperCase().replace(/\s+/g, '')
}

// Rimuove accenti/punteggiatura e normalizza gli spazi per il confronto "morbido" dei nomi
function normalizeForMatch(s) {
  return (s || '')
    .toString()
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cerca, tra i clienti CRM, quello il cui nome è contenuto nel nome esteso del file
// (es. CRM "IPERAL" dentro file "IPERAL SUPERMERCATI S.p.A. con socio unico").
// Preferisce il nome CRM più lungo/specifico tra quelli che corrispondono.
function suggestCustomerMatch(fileName, customers) {
  const normFile = normalizeForMatch(fileName)
  if (!normFile) return null
  let best = null
  for (const c of customers) {
    const normCrm = normalizeForMatch(c.company_name)
    if (normCrm.length < 3) continue
    if (normFile === normCrm) return c.id
    const isContained = normFile.startsWith(normCrm + ' ') || normFile.endsWith(' ' + normCrm) || normFile.includes(' ' + normCrm + ' ') || normFile.startsWith(normCrm)
    if (isContained && (!best || normCrm.length > best.len)) best = { id: c.id, len: normCrm.length }
  }
  return best ? best.id : null
}

// Deduce il brand a partire dalla descrizione, confrontando con i brand esistenti
function detectBrand(description, brands) {
  const normDesc = normalize(description)
  for (const b of brands) {
    if (normDesc.startsWith(normalize(b.name))) return b.id
  }
  return null
}

async function parseExcelFile(file) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  return raw
}

// Legge una colonna anche se il nome nel file ha punteggiatura/spazi leggermente diversi
// (es. "Rag.Soc." nel file vs "Rag.Soc" nel codice)
function getCol(row, ...names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return row[name]
  }
  return ''
}

export default function SellinImportPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [rawRows, setRawRows] = useState([])

  // Step Clienti: { [code]: { name, customerId: '' | number, isNew: bool, newName: '' } }
  const [customerAssign, setCustomerAssign] = useState({})
  // Step Prodotti: { [ean]: { sku, description, brandId, existingProductId } }
  const [productAssign, setProductAssign] = useState({})
  // Step 4
  const [importName, setImportName] = useState('')
  const [numMonths, setNumMonths] = useState('')
  const [importYear, setImportYear] = useState(new Date().getFullYear())
  const [pointsByCustomer, setPointsByCustomer] = useState({}) // { customerId: numPoints }

  const [finalizing, setFinalizing] = useState(false)
  const [finalizeError, setFinalizeError] = useState('')

  const { data: customers = [] }      = useCustomers()
  const { data: allProducts = [] }    = useProducts()
  const { data: brands = [] }         = useBrands()
  const { data: mappings = [] }       = useCustomerMappings()
  const upsertCustomer                = useUpsertCustomer()
  const createProductsBulk            = useCreateProductsBulk()
  const finalizeImport                = useFinalizeSellinImport()

  const mappingByCode = useMemo(() => {
    const map = {}
    for (const m of mappings) map[m.gestionale_code] = m
    return map
  }, [mappings])

  const productByEan = useMemo(() => {
    const map = {}
    for (const p of allProducts) map[p.ean] = p
    return map
  }, [allProducts])

  // -------- Step 1: upload + parsing --------
  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError('')
    setParsing(true)
    try {
      const raw = await parseExcelFile(file)
      if (raw.length === 0) throw new Error('Il file non contiene righe.')

      // Normalizza le righe grezze nei campi che ci servono
      const rows = raw.map(r => ({
        customerCode: String(getCol(r, 'Cliente')).trim(),
        customerName: String(getCol(r, 'Rag.Soc.', 'Rag.Soc', 'RagSoc')).trim(),
        month:        Number(getCol(r, 'Mese')),
        ean:          String(getCol(r, 'EAN')).trim(),
        sku:          String(getCol(r, 'Articolo')).trim(),
        description:  String(getCol(r, 'Descrizione')).trim(),
        qty:          Number(getCol(r, 'Qta')) || 0,
      })).filter(r => r.customerCode && r.ean && r.month >= 1 && r.month <= 12)

      if (rows.length === 0) throw new Error('Nessuna riga valida trovata. Controlla i nomi delle colonne (Cliente, Rag.Soc, Mese, EAN, Articolo, Descrizione, Qta).')

      setRawRows(rows)

      // Precompila assegnazione clienti: prima dal mapping già esistente,
      // poi con un suggerimento automatico per nome (es. "IPERAL SUPERMERCATI..." -> "IPERAL")
      const custMap = {}
      for (const r of rows) {
        if (custMap[r.customerCode]) continue
        const existing = mappingByCode[r.customerCode]
        const suggestedId = existing ? null : suggestCustomerMatch(r.customerName, customers)
        custMap[r.customerCode] = {
          name: r.customerName,
          customerId: existing ? existing.customer_id : (suggestedId || ''),
          isNew: false,
          newName: '',
          suggested: !existing && !!suggestedId,
        }
      }
      setCustomerAssign(custMap)

      // Precompila assegnazione prodotti da EAN già esistenti
      const prodMap = {}
      for (const r of rows) {
        if (prodMap[r.ean]) continue
        const existing = productByEan[r.ean]
        prodMap[r.ean] = {
          sku: r.sku,
          description: r.description,
          existingProductId: existing ? existing.id : null,
          brandId: existing ? existing.brand_id : detectBrand(r.description, brands),
        }
      }
      setProductAssign(prodMap)

      setImportName(`Import ${file.name.replace(/\.[^.]+$/, '')} — ${new Date().toLocaleDateString('it-IT')}`)
      setStep(1)
    } catch (err) {
      setParseError(err.message || 'Errore durante la lettura del file.')
    } finally {
      setParsing(false)
    }
  }

  // -------- Step 2: clienti --------
  const unresolvedCustomers = Object.entries(customerAssign).filter(([, v]) => !v.customerId && !v.isNew)
  function setCustomerChoice(code, patch) {
    setCustomerAssign(prev => ({ ...prev, [code]: { ...prev[code], ...patch } }))
  }

  // Marca come "nuovo cliente" tutti i codici senza abbinamento, copiando il nome esatto dal file
  function handleBulkCreateNew() {
    setCustomerAssign(prev => {
      const updated = { ...prev }
      for (const [code, v] of Object.entries(prev)) {
        if (!v.customerId && !v.isNew) {
          updated[code] = { ...v, isNew: true, newName: v.name }
        }
      }
      return updated
    })
  }

  const [advancingCustomers, setAdvancingCustomers] = useState(false)
  const [advanceError, setAdvanceError] = useState('')

  // Avanza dallo step Clienti: crea subito i clienti nuovi così hanno un id reale
  // disponibile per lo step "Punti vendita"
  async function handleAdvanceFromCustomers() {
    setAdvanceError('')
    const missingNew = Object.entries(customerAssign).filter(([, v]) => v.isNew && !v.newName.trim())
    if (missingNew.length > 0) return setAdvanceError('Inserisci il nome per tutti i nuovi clienti, oppure abbinali a un cliente esistente.')

    setAdvancingCustomers(true)
    try {
      const updated = { ...customerAssign }
      for (const [code, v] of Object.entries(customerAssign)) {
        if (!v.isNew) continue
        const created = await upsertCustomer.mutateAsync({ company_name: v.newName.trim() })
        updated[code] = { ...v, customerId: created.id, isNew: false }
      }
      setCustomerAssign(updated)
      setStep(2)
    } catch (err) {
      setAdvanceError('Errore nella creazione dei clienti: ' + (err.message || 'riprova.'))
    } finally {
      setAdvancingCustomers(false)
    }
  }

  // -------- Step 3: prodotti --------
  const unresolvedProducts = Object.entries(productAssign).filter(([, v]) => !v.existingProductId && !v.brandId)
  function setProductChoice(ean, patch) {
    setProductAssign(prev => ({ ...prev, [ean]: { ...prev[ean], ...patch } }))
  }
  const [bulkBrandId, setBulkBrandId] = useState('')
  function handleBulkAssignBrand() {
    if (!bulkBrandId) return
    setProductAssign(prev => {
      const updated = { ...prev }
      for (const [ean, v] of Object.entries(prev)) {
        if (!v.existingProductId && !v.brandId) updated[ean] = { ...v, brandId: Number(bulkBrandId) }
      }
      return updated
    })
    setBulkBrandId('')
  }

  // -------- Step 4: mesi + punti vendita --------
  const resolvedCustomerIds = useMemo(() => {
    // Elenco distinto dei customer_id risolti (esistenti o "nuovo" placeholder gestito a parte)
    const ids = new Set()
    Object.values(customerAssign).forEach(v => { if (v.customerId) ids.add(v.customerId) })
    return [...ids]
  }, [customerAssign])

  function customerLabel(id) {
    return customers.find(c => c.id === id)?.company_name || `#${id}`
  }

  // -------- Finalizzazione --------
  async function handleFinalize() {
    setFinalizeError('')
    if (!importName.trim()) return setFinalizeError('Inserisci un nome per l\'import.')
    const nm = Number(numMonths)
    if (!nm || nm < 1 || nm > 12) return setFinalizeError('Inserisci un numero di mesi valido (1-12).')
    if (!importYear || importYear < 2020 || importYear > 2099) return setFinalizeError('Inserisci un anno valido.')

    setFinalizing(true)
    try {
      // 1. Crea i clienti nuovi richiesti in step 2
      const codeToCustomerId = {}
      for (const [code, v] of Object.entries(customerAssign)) {
        if (v.customerId) { codeToCustomerId[code] = v.customerId; continue }
        if (v.isNew) {
          const created = await upsertCustomer.mutateAsync({ company_name: v.newName || v.name })
          codeToCustomerId[code] = created.id
        }
      }

      // 2. Crea i prodotti nuovi richiesti in step 3
      const eanToProductId = {}
      const toCreate = []
      for (const [ean, v] of Object.entries(productAssign)) {
        if (v.existingProductId) { eanToProductId[ean] = v.existingProductId; continue }
        toCreate.push({ ean, sku: v.sku, description: v.description, description_report: v.description, brand_id: v.brandId })
      }
      if (toCreate.length > 0) {
        const created = await createProductsBulk.mutateAsync(toCreate)
        for (const p of created) eanToProductId[p.ean] = p.id
      }

      // 3. Prepara i nuovi abbinamenti cliente permanenti (solo quelli non già mappati)
      const newMappings = Object.entries(customerAssign)
        .filter(([code]) => !mappingByCode[code])
        .map(([code, v]) => ({ gestionale_code: code, gestionale_name: v.name, customer_id: codeToCustomerId[code] }))

      // 4. Punti vendita per cliente (opzionali: se non inseriti, 0)
      const allCustomerIdsInvolved = [...new Set(Object.values(codeToCustomerId))]
      const importCustomers = allCustomerIdsInvolved.map(cid => ({
        customer_id: cid,
        num_points: Number(pointsByCustomer[cid]) || 0,
      }))
      // 5. Aggrega le righe per cliente+prodotto+mese e prepara l'insert finale
      const agg = {}
      for (const r of rawRows) {
        const customerId = codeToCustomerId[r.customerCode]
        const productId  = eanToProductId[r.ean]
        if (!customerId || !productId) continue
        const key = `${customerId}_${productId}_${r.month}`
        if (!agg[key]) agg[key] = { customer_id: customerId, product_id: productId, month: r.month, qty: 0 }
        agg[key].qty += r.qty
      }
      const lines = Object.values(agg)

      await finalizeImport.mutateAsync({ name: importName.trim(), year: importYear, numMonths: nm, newMappings, importCustomers, lines })
      navigate('/sellin/report')
    } catch (err) {
      setFinalizeError('Errore durante il salvataggio: ' + (err.message || 'riprova.'))
    } finally {
      setFinalizing(false)
    }
  }

  const canGoStep2 = unresolvedCustomers.length === 0 &&
    Object.values(customerAssign).every(v => !v.isNew || v.newName.trim())
  const canGoStep3 = unresolvedProducts.length === 0

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Nuovo import Sell-in" description="Carica ed elabora un file di venduto dal gestionale" />

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${i === step ? '' : i < step ? '' : ''}`}
              style={{
                backgroundColor: i === step ? 'var(--brand)' : i < step ? 'var(--brand-50)' : 'var(--alt-row)',
                color: i === step ? 'white' : i < step ? 'var(--brand)' : 'var(--text-muted)',
              }}>
              {i < step ? <Check size={12} /> : <span>{i + 1}</span>}
              {s}
            </div>
            {i < STEPS.length - 1 && <div className="w-4 h-px" style={{ backgroundColor: 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {/* STEP 0: upload */}
      {step === 0 && (
        <div className="card p-8 flex flex-col items-center justify-center gap-4 text-center">
          <Upload size={32} style={{ color: 'var(--text-muted)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>Carica il file Excel esportato dal gestionale</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Colonne attese: Cliente, Rag.Soc, Mese, EAN, Articolo, Descrizione, Qta</p>
          </div>
          <label className="btn-primary cursor-pointer">
            {parsing ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload size={15} />}
            {parsing ? 'Lettura in corso…' : 'Scegli file'}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} disabled={parsing} />
          </label>
          {fileName && !parseError && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{fileName}</p>}
          {parseError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{parseError}</p>}
        </div>
      )}

      {/* STEP 1: clienti */}
      {step === 1 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>Abbinamento clienti</h2>
            {unresolvedCustomers.length > 0 && (
              <button className="btn-secondary text-xs" onClick={handleBulkCreateNew}>
                <Plus size={13} /> Crea come nuovi i {unresolvedCustomers.length} clienti mancanti
              </button>
            )}
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            {Object.keys(customerAssign).length} clienti trovati nel file · {Object.values(customerAssign).filter(v => v.customerId && !v.suggested).length} già riconosciuti ·
            {' '}{Object.values(customerAssign).filter(v => v.suggested).length} suggeriti da verificare
          </p>
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid var(--border)` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--alt-row)' }}>
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Codice</th>
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Nome nel file</th>
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Cliente CRM</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {Object.entries(customerAssign).map(([code, v]) => {
                  const alreadyMapped = !!mappingByCode[code]
                  return (
                    <tr key={code}>
                      <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{code}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-main)' }}>{v.name}</td>
                      <td className="px-3 py-2">
                        {alreadyMapped ? (
                          <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#16a34a' }}>
                            <Check size={13} /> {customerLabel(v.customerId)}
                          </span>
                        ) : v.isNew ? (
                          <div className="flex items-center gap-2">
                            <input className="input text-xs" style={{ width: '220px' }} placeholder="Nome nuovo cliente"
                              value={v.newName} onChange={e => setCustomerChoice(code, { newName: e.target.value })} />
                            <button className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}
                              onClick={() => setCustomerChoice(code, { isNew: false, newName: '' })}>Annulla</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select className="input text-xs" style={{ width: '220px' }} value={v.customerId}
                              onChange={e => setCustomerChoice(code, { customerId: e.target.value ? Number(e.target.value) : '', suggested: false })}>
                              <option value="">— Seleziona cliente —</option>
                              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                            </select>
                            {v.suggested && v.customerId && (
                              <span className="text-xs" style={{ color: '#d97706' }}>suggerito — verifica</span>
                            )}
                            <button className="text-xs hover:underline flex items-center gap-1" style={{ color: 'var(--brand)' }}
                              onClick={() => setCustomerChoice(code, { isNew: true })}>
                              <Plus size={12} /> Nuovo
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 2: prodotti */}
      {step === 2 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>Abbinamento prodotti</h2>
            {unresolvedProducts.length > 0 && (
              <div className="flex items-center gap-2">
                <select className="input text-xs" style={{ width: '180px' }} value={bulkBrandId} onChange={e => setBulkBrandId(e.target.value)}>
                  <option value="">— Assegna brand a tutti i {unresolvedProducts.length} mancanti —</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button className="btn-secondary text-xs" onClick={handleBulkAssignBrand} disabled={!bulkBrandId}>
                  Applica a tutti
                </button>
              </div>
            )}
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            {Object.keys(productAssign).length} prodotti trovati nel file · {Object.values(productAssign).filter(v => v.existingProductId).length} già in anagrafica ·
            {' '}{Object.values(productAssign).filter(v => !v.existingProductId).length} da creare
          </p>
          <div className="rounded-lg overflow-hidden max-h-[500px] overflow-y-auto" style={{ border: `1px solid var(--border)` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--alt-row)' }}>
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>EAN</th>
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Descrizione</th>
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Stato</th>
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Brand</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {Object.entries(productAssign).map(([ean, v]) => (
                  <tr key={ean}>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{ean}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-main)' }}>{v.description}</td>
                    <td className="px-3 py-2">
                      {v.existingProductId ? (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#16a34a' }}><Check size={13} /> Esistente</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--brand)' }}><Plus size={13} /> Nuovo prodotto</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {v.existingProductId ? (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{brands.find(b => b.id === v.brandId)?.name || '—'}</span>
                      ) : v.brandId ? (
                        <span className="text-xs" style={{ color: '#16a34a' }}>{brands.find(b => b.id === v.brandId)?.name} (auto)</span>
                      ) : (
                        <select className="input text-xs" style={{ width: '160px' }} value={v.brandId || ''}
                          onChange={e => setProductChoice(ean, { brandId: e.target.value ? Number(e.target.value) : null })}>
                          <option value="">— Assegna brand —</option>
                          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 3: mesi + punti vendita */}
      {step === 3 && (
        <div className="card p-5">
          <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-main)' }}>Mesi e punti vendita</h2>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div>
              <label className="label">Nome import</label>
              <input className="input" value={importName} onChange={e => setImportName(e.target.value)} />
            </div>
            <div>
              <label className="label">Anno di riferimento</label>
              <input className="input" type="number" min="2020" max="2099" value={importYear}
                onChange={e => setImportYear(Number(e.target.value))} />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Usato per sommare automaticamente più import dello stesso anno.</p>
            </div>
            <div>
              <label className="label">Numero mesi coperti dall'import</label>
              <input className="input" type="number" min="1" max="12" placeholder="es. 9" value={numMonths}
                onChange={e => setNumMonths(e.target.value)} />
            </div>
          </div>

          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Punti vendita per ciascun cliente coinvolto in questo import (opzionale — se lasciato vuoto viene usato 0):</p>
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid var(--border)` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--alt-row)' }}>
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Cliente</th>
                  <th className="text-right px-3 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Punti vendita</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {[...new Set(Object.values(customerAssign).map(v => v.customerId).filter(Boolean))].map(cid => (
                  <tr key={cid}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-main)' }}>{customerLabel(cid)}</td>
                    <td className="px-3 py-2 text-right">
                      <input className="input text-right text-xs" style={{ width: '100px', marginLeft: 'auto' }} type="number" min="1" step="1"
                        value={pointsByCustomer[cid] || ''}
                        onChange={e => setPointsByCustomer(prev => ({ ...prev, [cid]: e.target.value }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 4: conferma */}
      {step === 4 && (
        <div className="card p-5">
          <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-main)' }}>Conferma import</h2>
          <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--alt-row)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Righe totali</p>
              <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{rawRows.length}</p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--alt-row)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Clienti coinvolti</p>
              <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{Object.keys(customerAssign).length}</p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--alt-row)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Prodotti nuovi da creare</p>
              <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{Object.values(productAssign).filter(v => !v.existingProductId).length}</p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--alt-row)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Mesi coperti</p>
              <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{numMonths || '—'}</p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--alt-row)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Anno</p>
              <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{importYear}</p>
            </div>
          </div>
          {finalizeError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{finalizeError}</p>}
          <button className="btn-primary" onClick={handleFinalize} disabled={finalizing}>
            {finalizing ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={15} />}
            {finalizing ? 'Salvataggio in corso…' : 'Conferma e importa'}
          </button>
        </div>
      )}

      {/* Navigazione step */}
      {step > 0 && (
        <div className="flex justify-between mt-4">
          <button className="btn-secondary" onClick={() => setStep(s => s - 1)} disabled={finalizing || advancingCustomers}>
            <ArrowLeft size={15} /> Indietro
          </button>
          {step < 4 && (
            <button className="btn-primary"
              onClick={() => {
                if (step === 1) { handleAdvanceFromCustomers(); return }
                setStep(s => s + 1)
              }}
              disabled={(step === 1 && (!canGoStep2 || advancingCustomers)) || (step === 2 && !canGoStep3)}>
              {step === 1 && advancingCustomers
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <>Avanti <ArrowRight size={15} /></>
              }
            </button>
          )}
        </div>
      )}
      {step === 1 && advanceError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{advanceError}</p>
      )}
    </div>
  )
}
