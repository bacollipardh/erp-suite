# Phase 3 - POS WMS Auto-Post Flow

## Qellimi

POS / Shitja e shpejte nuk duhet ta postoje faturen direkt kur sistemi ka WMS aktiv. Tani rrjedha eshte:

1. Krijohet sales invoice nga POS.
2. Sistemi krijon rezervimet dhe task-at WMS per ate fature.
3. Picking konfirmohet.
4. Packing kompletohet.
5. Vetem pastaj fatura postohet dhe merr efekt financiar/stok.

Kjo e mbron sistemin nga situata ku financa postohet pa dalje reale nga WMS.

## Opsioni pa WMS

POS dhe forma standarde e fatures se shitjes kane opsionin `Posto pa WMS`.

Kur ky opsion aktivizohet:

1. Perdoruesi duhet te shkruaje arsyen e bypass-it.
2. Fatura postohet pa krijuar/kerkuar pick dhe pack task.
2. Stoku zbritet normalisht.
3. WMS stock zbritet direkt nga lokacionet e disponueshme dhe ruhen levizjet `SHIP`.
4. Financat, kontimet dhe kartela e bleresit marrin efekt si ne postimin normal.

Nese fatura ka WMS task ose rezervim aktiv, sistemi nuk lejon bypass derisa WMS te lirohet ose perfundohet. Kjo shmang dy dalje paralele per te njejten fature.

## Cfare ndryshoi

- `frontend/components/sales-agent/pos-form.tsx`
  - Pas krijimit te fatures thirret automatikisht WMS plan/pick/pack.
  - Fatura postohet vetem pasi WMS te kompletohet.
  - U shtua checkbox `Posto pa WMS` dhe fusha e arsyes per raste kur nuk duhet workflow pick/pack.
  - Nese WMS ose postimi deshton, fatura mbetet draft dhe UI tregon mesazh paralajmerues me link te fatures.

- `frontend/components/invoices/sales-invoice-form.tsx`
  - Faturat draft mund te postohen me workflow WMS ose me bypass WMS me arsye te detyrueshme.

- `frontend/components/invoices/document-action-panel.tsx`
  - Faqja e fatures tregon `Statusi WMS`: mode, Pick, Pack, Ship, task aktive, sasite dhe arsye bypass.

- `backend/src/sales-invoices`
  - Endpoint-i i postimit pranon `skipWms: true` dhe `skipWmsReason`.
  - Detaji i fatures kthen `wmsSummary` per UI.

- `backend/src/wms/wms.service.ts`
  - U shtua direct WMS shipment per bypass: nuk krijon task-a, por zbrit WMS stock dhe ruan levizjet.

- `docs/sales-wms-finance-operational-guide.md`
  - U shtua dokumentim praktik per shitje, WMS, kthime, pagesa, kartela dhe audit trail.

- `scripts/smoke-pos-wms-flow.mjs`
  - Teston rrjedhen POS -> WMS -> posted invoice permes API.
  - Verifikon qe fatura eshte `POSTED`, rezervimet jane `SHIPPED`, dhe nuk mbeten task-a te hapura.

- `package.json`
  - U shtua komanda `npm run smoke:pos-wms`.

## Si testohet

Me Docker te ndezur:

```powershell
docker compose run --rm backend npm run prisma:seed
npm run smoke:pos-wms
npm run smoke:pos-no-wms
```

Per UI:

1. Hape `http://localhost:3001/agjenti-shitjes`.
2. Zgjidh bleresin, magazinen, serien dhe artikullin.
3. Kliko `Krijo & Posto Faturen`.
4. Suksesi duhet te tregoje qe WMS u kompletua dhe fatura u postua.
5. Per bypass, aktivizo `Posto pa WMS` para klikimit.

## Shenime operative

- POS eshte rrjedhe cash-and-carry, prandaj WMS behet automatikisht ne prapavije.
- Nese artikulli nuk ka stok te lire, lokacion WMS, ose ka bllokim/karantine, fatura krijohet si draft dhe postimi ndalet.
- Rrjedhat me picker te dedikuar mbeten te moduli i Agent Orders.
