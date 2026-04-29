# Phase 3 - POS WMS Auto-Post Flow

## Qellimi

POS / Shitja e shpejte nuk duhet ta postoje faturen direkt kur sistemi ka WMS aktiv. Tani rrjedha eshte:

1. Krijohet sales invoice nga POS.
2. Sistemi krijon rezervimet dhe task-at WMS per ate fature.
3. Picking konfirmohet.
4. Packing kompletohet.
5. Vetem pastaj fatura postohet dhe merr efekt financiar/stok.

Kjo e mbron sistemin nga situata ku financa postohet pa dalje reale nga WMS.

## Cfare ndryshoi

- `frontend/components/sales-agent/pos-form.tsx`
  - Pas krijimit te fatures thirret automatikisht WMS plan/pick/pack.
  - Fatura postohet vetem pasi WMS te kompletohet.
  - Nese WMS ose postimi deshton, fatura mbetet draft dhe UI tregon mesazh paralajmerues me link te fatures.

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
```

Per UI:

1. Hape `http://localhost:3001/agjenti-shitjes`.
2. Zgjidh bleresin, magazinen, serien dhe artikullin.
3. Kliko `Krijo & Posto Faturen`.
4. Suksesi duhet te tregoje qe WMS u kompletua dhe fatura u postua.

## Shenime operative

- POS eshte rrjedhe cash-and-carry, prandaj WMS behet automatikisht ne prapavije.
- Nese artikulli nuk ka stok te lire, lokacion WMS, ose ka bllokim/karantine, fatura krijohet si draft dhe postimi ndalet.
- Rrjedhat me picker te dedikuar mbeten te moduli i Agent Orders.
