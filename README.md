# Checkout — Sandbox Store

Microfrontend React 19 / Vite, con Module Federation tramite `@originjs/vite-plugin-federation`. Il modulo `checkout/Checkout` esporta `Checkout` sia come export nominato sia come default. L'entry federata resta `assets/remoteEntry.js`; configurazione di federation e rilascio invariate.

## UI e limiti della demo

Il checkout include contatti e indirizzo italiano, opzioni di spedizione **illustrative**, riepilogo modificabile, codici sconto demo e totali. I prezzi sono al netto dell'IVA demo del 22%, come nel componente originale; i calcoli sono arrotondati in centesimi. `SANDBOX10` e `MFE20` sono esclusivamente codici di esempio.

Nel repository non sono presenti servizi di carrello, ordine, spedizione o pagamento verificati. Il passaggio pagamento spiega questa limitazione: **non ci sono campi carta, addebiti, reindirizzamenti, ordini generati o email inviate**. Il pulsante finale esegue soltanto una verifica locale e lo comunica esplicitamente, senza mostrare una conferma di acquisto. La verifica ha uno stato di caricamento, blocca le modifiche e gli invii duplicati e viene annullata allo smontaggio. Non introduce endpoint, eventi, log o persistenza nel browser. Usare solo dati fittizi; i contatti restano nello stato React fino allo smontaggio/ricaricamento.

## Contratto con la shell

```jsx
import Checkout from "checkout/Checkout"

<Checkout items={items} onOrderPlaced={onOrderPlaced} />
```

- `items`: array di `{ id, name, price, qty, variant?, emoji? }`. `id` e `name` sono stringhe non vuote, gli ID univoci, `price` un numero finito non negativo in euro e `qty` un intero positivo. Gli importi devono essere rappresentabili in centesimi sicuri. `variant` ed `emoji` sono testi facoltativi. Un array vuoto mostra lo stato di carrello vuoto; dati non validi bloccano il checkout con un errore.
- Senza `items` viene mostrato il catalogo demo già presente. Solo in questo caso si possono ripristinare i prodotti dopo aver svuotato il carrello.
- Le modifiche di quantità sono locali, come nel componente originale: nessun evento o callback di sincronizzazione è stato aggiunto. Una nuova reference della prop `items` sostituisce il carrello locale e invalida la verifica precedente. La shell deve aggiornare la prop in modo immutabile.
- `onOrderPlaced` resta accettata per compatibilità, ma **non viene invocata dalla demo**. Il comportamento precedente emetteva un ordine fittizio: è stato rimosso per evitare false conferme e aggiornamenti errati nella shell. Un futuro collegamento a servizi reali richiede un contratto verificato; la presenza di questa callback, da sola, non autorizza a creare o simulare un ordine.

I CSS sono confinati a `.co-root`; il layout si adatta anche alla larghezza del contenitore della shell e supporta tema scuro e movimento ridotto. Etichette, errori associati ai campi, gruppi radio nativi, focus sui campi non validi e annunci degli stati sono in italiano.

## Verifiche

- `pnpm dev`: anteprima standalone.
- `pnpm build`: build Vite, inclusa l'esposizione federata.
- `pnpm test`: test unitari con `node:test`, senza nuove dipendenze, per indirizzo, carrello non valido/vuoto, quantità, promozioni, arrotondamenti e limiti numerici.
- Non sono presenti script o configurazioni di lint, né una suite di test UI nel repository.

**Build, test e controlli browser non eseguiti durante questa modifica:** l'ambiente dell'agente non consente di eseguire comandi. Eseguire `pnpm test` e `pnpm build` prima del merge.

### Controlli manuali da eseguire

1. Montare il remote dalla shell con carrello valido, `[]` e dati malformati; aggiornare la prop `items` durante la navigazione e la verifica.
2. Navigare con Tab, Shift+Tab, Invio e frecce nei radio. Inviare un indirizzo vuoto e controllare focus sul primo errore, etichette e annunci con uno screen reader.
3. Verificare layout a 320 px, a zoom 200%, in un contenitore stretto della shell, in tema scuro e con movimento ridotto.
4. Modificare quantità fino a svuotare il carrello, applicare/rimuovere sconti e provare un codice non valido; controllare totali e assenza di spese a carrello vuoto.
5. Effettuare più invii consecutivi del riepilogo; controllare il blocco durante la verifica, la dicitura demo finale e che `onOrderPlaced` non venga chiamata. Smontare il componente durante la verifica: nessuna attività deve proseguire.
6. Controllare dalla scheda Network che la compilazione e la verifica non inviino dati. Nessun campo sensibile di carta deve essere presente.
