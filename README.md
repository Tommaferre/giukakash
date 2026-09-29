# GiukaKash

Web app standalone per la gestione personale del patrimonio: conti, movimenti (entrate/uscite/trasferimenti) e statistiche. Nessun backend, nessun login: tutti i dati restano nel browser (localStorage) e l'app funziona offline dopo il primo caricamento (Service Worker).

## Struttura del progetto

```
moneyapp/
├── index.html          punto di ingresso, layout e navigazione
├── manifest.json        manifest PWA (icona, nome, tema)
├── sw.js                 service worker per il funzionamento offline
├── css/
│   └── style.css        tutto lo stile dell'app
├── js/
│   ├── db.js            modello dati, storage, calcolo saldi e statistiche
│   ├── charts.js        grafici SVG (linea, donut, barre) senza librerie esterne
│   ├── render.js        generazione dell'HTML delle schermate
│   └── app.js            router, gestione eventi, modali
└── icons/                icone dell'app (192, 512, maskable)
```

## Pubblicare su GitHub Pages

1. Crea un nuovo repository su GitHub (es. `le-mie-finanze`).
2. Carica tutti i file mantenendo la struttura di cartelle sopra indicata (l'intero contenuto di questa cartella `moneyapp/` deve stare nella radice del repository, oppure in `/docs` se preferisci).
3. Vai su **Settings → Pages** del repository.
4. In **Source**, seleziona il branch (es. `main`) e la cartella (`/root` o `/docs`).
5. Salva: dopo circa un minuto l'app sarà disponibile all'indirizzo `https://<tuo-utente>.github.io/<nome-repo>/`.
6. Apri il link da smartphone: puoi anche aggiungerlo alla schermata Home (Safari: Condividi → Aggiungi a Home; Chrome Android: menu → Aggiungi a schermata Home) per un'esperienza tipo app.

Non serve alcuna build: sono solo file statici HTML/CSS/JS.

## Funzionamento offline

Al primo caricamento il Service Worker (`sw.js`) mette in cache tutti i file dell'app. Dai caricamenti successivi l'app funziona anche senza connessione. Se aggiorni i file dopo la pubblicazione, cambia il valore `CACHE_NAME` in `sw.js` (es. `moneyapp-cache-v2`) così i dispositivi già visitati scaricheranno la nuova versione.

## Dati e backup

- I dati (conti, movimenti, categorie) sono salvati **solo nel browser** dell'utente (localStorage), in modo isolato per ogni dominio/dispositivo.
- Da **Impostazioni → Esporta dati** puoi scaricare un backup JSON completo.
- Da **Impostazioni → Importa dati** puoi ripristinare un backup (i dati attuali vengono sovrascritti, con richiesta di conferma).
- Si consiglia di esportare un backup periodicamente, dato che i dati non sono sincronizzati altrove: cancellare i dati del browser o cambiare dispositivo comporta la perdita dei dati se non è stato fatto un backup.

## Logica dei saldi

Il saldo di ogni conto **non** viene modificato direttamente: viene sempre ricalcolato a partire dal saldo iniziale e dallo storico dei movimenti:

```
saldo attuale = saldo iniziale + entrate − uscite + trasferimenti ricevuti − trasferimenti inviati
```

Questo garantisce che modificare o eliminare un movimento aggiorni automaticamente saldi, patrimonio totale e statistiche, che sono sempre calcolati "al volo" dai dati grezzi.

Gli importi sono gestiti internamente in centesimi (interi) per evitare errori di arrotondamento.
