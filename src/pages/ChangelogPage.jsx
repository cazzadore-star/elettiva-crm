import PageHeader from '../components/ui/PageHeader'

// ============================================================
// CHANGELOG — aggiungi una nuova voce in cima ad ogni release
// ============================================================
const CHANGELOG = [
  {
    version: 'v1.8.0',
    date: '2026-08-23',
    items: [
      'Introdotta la gestione multi-brand: il sistema ora supporta più brand oltre a Monday (es. 7Days, Daisy…)',
      'Nuovo selettore "Brand attivo" sotto il logo in sidebar, salvato per browser: ogni utente può lavorare su un brand diverso senza interferire con gli altri',
      'Aggiunto il campo Brand ai prodotti, obbligatorio in creazione e modifica',
      'La pagina Prodotti mostra tutti i brand con filtro dedicato; tutte le altre pagine (Forecast, Report, Rotazioni, Listini medi, Dashboard) si filtrano automaticamente sul brand attivo selezionato',
      'Nuova sezione "Brand" in Impostazioni per creare nuovi brand',
      'Il cambio del brand attivo ricarica automaticamente la pagina per aggiornare tutti i dati',
    ],
  },
  {
    version: 'v1.7.0',
    date: '2026-08-19',
    items: [
      'Aggiunto il ruolo utente "Visitatore": accesso in sola consultazione a tutte le pagine, con filtri, ricerca ed export sempre disponibili ma senza possibilità di creare, modificare o eliminare dati',
      'Il Visitatore non vede la voce "Impostazioni" nel menu',
      'Reintrodotta la riga "Totale generale" nel Report, che era stata rimossa in precedenza su richiesta',
    ],
  },
  {
    version: 'v1.6.0',
    date: '2026-08-18',
    items: [
      'Pulsante "Archivia" spostato dalla pagina Archivio alla pagina Forecast: ora salva esattamente le righe filtrate visualizzate al momento, non più tutto il forecast',
      'Pagina Archivio semplificata: solo consultazione, esportazione ed eliminazione degli snapshot esistenti',
      'Filtri multi-select con ricerca (clienti, prodotti, categorie) nella pagina Forecast, in aggiunta al filtro rotazione singolo',
      'Filtro multi-select clienti nel Report, con ricalcolo automatico dei totali sui soli clienti selezionati',
      'Possibilità di escludere intere categorie prodotto dal Report, gestibile dalla pagina Impostazioni, con opzione per mostrarle temporaneamente',
      'Rimossa la colonna "Valore" e la riga "Totale generale" dal Report su richiesta',
      'Aggiunta questa pagina di cronologia aggiornamenti, visibile a tutti gli utenti',
    ],
  },
  {
    version: 'v1.5.0',
    date: '2026-08-18',
    items: [
      'Aggiunto export Excel del Forecast, che rispetta tutti i filtri applicati (cliente, prodotto, categoria, rotazione, ricerca testuale)',
      'Aggiunto pulsante "Ricalcola da rotazioni" nel Forecast: azzera i mesi coperti da rotazioni attive e li riscrive da zero, eliminando i valori residui lasciati da rotazioni modificate o eliminate',
      'Corretto un bug per cui il forecast manteneva vecchi valori nei mesi fuori dal periodo di una rotazione aggiornata',
      'Corretto un bug per cui il listino medio non veniva aggiornato nel forecast dopo aver inserito un prezzo mancante e riapplicato la rotazione',
      'Corretto un bug per cui la griglia del Forecast non si aggiornava visivamente dopo un ricalcolo, richiedendo un refresh manuale',
    ],
  },
  {
    version: 'v1.4.0',
    date: '2026-08-17',
    items: [
      'Introdotto un sistema di ruoli utente: Admin (accesso completo, incluso il log operazioni) e Operatore (accesso a tutto tranne il log)',
      'Aggiunta la pagina "Log operazioni": audit trail completo di ogni inserimento, modifica ed eliminazione su Forecast, Rotazioni, Listini, Prodotti, Clienti e Report, con utente e timestamp',
      'Implementato il tema chiaro / scuro con toggle in sidebar, usando come colore principale l\'oro Elettiva (#C8962A)',
      'Aggiunto un modal di dettaglio cliente nella Dashboard: cliccando su un nome cliente si apre un grafico mensile, KPI e lista prodotti per quel cliente',
      'Aggiunta la sezione "Confronto anno precedente" nella Dashboard, con tab Clienti/Prodotti e variazione percentuale',
      'Aggiunti filtri cliente, categoria e prodotto alla Dashboard, applicabili insieme al filtro periodo',
      'Corretto il calcolo della "Rotazione media mensile/pdv" nella Dashboard, che sommava erroneamente i punti vendita di più rotazioni per lo stesso cliente',
    ],
  },
  {
    version: 'v1.3.0',
    date: '2026-08-15',
    items: [
      'Nuova pagina "Rotazioni": creazione di previsioni di ordine periodiche per cliente e prodotti, con applicazione automatica al Forecast tramite una funzione SQL dedicata',
      'Nel form Rotazioni, i prodotti già in rotazione per il cliente selezionato vengono evidenziati con il periodo di copertura',
      'Aggiunta la funzione "Duplica rotazione" e "Modifica rotazione"',
      'Nuova pagina "Impostazioni": periodo di riferimento globale e valore di rotazione default, usati come precompilazione nel form Rotazioni',
      'Nuova pagina "Archivio Forecast": snapshot storici del forecast, consultabili ed esportabili in Excel',
      'Importazione di SKU, descrizione report e categorie prodotto da un file Excel del fornitore',
      'Aggiornamento massivo del listino medio per cliente (bulk update su tutti i prodotti attivi)',
      'Possibilità di creare un nuovo listino selezionando più prodotti contemporaneamente',
    ],
  },
  {
    version: 'v1.2.0',
    date: '2026-08-10',
    items: [
      'Il Forecast e il Report ora supportano un range di mesi/anni continuo selezionabile (es. Ottobre 2026 → Maggio 2027), invece del singolo anno',
      'Aggiunti filtri cliente, prodotto, categoria e rotazione nel Forecast',
      'La ricerca testuale nel Forecast e nel Report ora trova i risultati indipendentemente dall\'ordine delle parole cercate',
      'Il Report è stato ristrutturato per aggregare correttamente i dati per prodotto sommando tutti i clienti, derivandoli dal Forecast con un\'anticipazione di un mese (Febbraio Forecast → Gennaio Report), gestendo correttamente anche il cambio anno',
      'Aggiunta la funzione di ordinamento delle categorie nel Report tramite un modal dedicato',
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-08-05',
    items: [
      'Corretto il grafico "Andamento mensile" della Dashboard, che non si aggiornava correttamente al primo caricamento',
      'Aggiunta la possibilità di scorrere l\'intera lista di clienti e prodotti nella Dashboard invece di vederne solo i primi 5-10',
      'Verificata e corretta la coerenza dei calcoli di fatturato e pezzi tra Dashboard, Forecast e Report',
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-08-03',
    items: [
      'Prima versione del CRM pubblicata online su Vercel, poi collegata al dominio forecast.elettiva.com',
      'Gestione anagrafica Prodotti, Clienti e Listini medi',
      'Pagina Forecast con griglia mensile per cliente e prodotto, celle modificabili in linea',
      'Pagina Report aggregata per categoria prodotto',
      'Dashboard con KPI principali (fatturato, pezzi, clienti, listini) e grafico andamento mensile',
      'Import iniziale di prodotti, clienti, listini e forecast da file Excel',
      'Autenticazione utenti con Supabase e accesso riservato',
    ],
  },
]

export default function ChangelogPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Cronologia aggiornamenti" description="Storico delle modifiche pubblicate sul sistema" />

      <div className="space-y-6">
        {CHANGELOG.map(release => (
          <div key={release.version} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base" style={{ color: 'var(--text-main)' }}>{release.version}</h2>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {new Date(release.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <ul className="space-y-1.5">
              {release.items.map((item, i) => (
                <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-sub)' }}>
                  <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: 'var(--brand)' }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
