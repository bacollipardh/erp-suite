# Faza 2 - Agent Order -> WMS -> Fature e postuar

Data: 2026-04-29  
Branch: `codex/integrim-erp-suite`

Qellimi i fazes 2 eshte qe nje order nga agjenti te kaloje ne rrjedhe reale:

`Agent Order -> Cakto picker -> Start WMS -> Perfundo WMS -> Krijo fature -> WMS pick/pack -> Posto fature -> Efekt stok/finance`

## Cfare u shtua

### 1. Postim direkt nga Agent Order

Te forma `Krijo fature shitje` ne Agent Order u shtua opsioni:

`Posto menjehere`

Kur ky opsion eshte aktiv:

1. krijohet sales invoice nga rreshtat e Agent Order;
2. sistemi planifikon WMS picking;
3. sistemi konfirmon WMS picking;
4. sistemi e shenon packing si te perfunduar;
5. fatura postohet;
6. stokut i bie sasia;
7. WMS reservations shkojne ne `SHIPPED`;
8. krijohet efekti kontabel/financiar i fatures.

Nese WMS ose approval gate e ndalon postimin, fatura mbetet draft dhe kthehet `postWarning`, qe user-i ta vazhdoje nga faqja e fatures.

### 2. Roli WMS per picker

Roli `WMS` tani ka permissions operative:

- WMS read/manage/receive/move/pick/count
- Agent Orders read/assign
- Items, warehouses, document series dhe payment methods read
- Sales invoices read

Nuk ka permissions per finance/accounting manage.

### 3. Pastrim i WMS packing task

U rregullua sjellja ku pas packing mbetej edhe nje `PACK:PENDING`. Tani task-u ekzistues `PACK:PENDING` mbyllet si `PACK:DONE`, dhe pas postimit mbeten vetem task-a te mbyllur.

### 4. Smoke script

U shtua komanda:

```powershell
npm run smoke:agent-wms
```

Kjo e teston rrjedhen:

1. login si admin;
2. gjen `AO-DEMO-0001`;
3. cakton `picker@erp.local`;
4. starton WMS;
5. perfundon WMS;
6. krijon dhe poston faturen;
7. verifikon qe WMS reservations jane `SHIPPED`;
8. verifikon qe nuk ka WMS tasks te hapura per faturen.

Para se ta ekzekutosh smoke script-in, nese `AO-DEMO-0001` eshte konsumuar nga nje test i meparshem, reset-o dataset-in:

```powershell
docker compose run --rm backend npm run prisma:seed
npm run smoke:agent-wms
```

## Rezultati i verifikuar

Pas reset-it te seed-it u ekzekutua rrjedha reale me `AO-DEMO-0001`.

Rezultati:

- Agent order: `AO-DEMO-0001`
- Status order: `DOCUMENT_CREATED`
- Fatura ne smoke test final: `FS-000003`
- Status fature: `POSTED`
- WMS ready: `true`
- Post warning: `null`
- Grand total: `790.60`
- Payment status: `UNPAID`

Efekti ne stok:

- `MONITOR-001`: `18 -> 16`
- `MOUSE-001`: `120 -> 115`

Efekti ne WMS:

- Reservations: `2`
- Reservation statuses: `SHIPPED, SHIPPED`
- WMS tasks:
  - `PICK:DONE`
  - `PICK:DONE`
  - `PACK:DONE`
  - `SHIP:DONE`

## Si perdoret nga UI

1. Hape `/agjenti/orders`.
2. Hape `AO-DEMO-0001`.
3. Kliko `Cakto picker`.
4. Zgjidh `picker@erp.local`.
5. Kthehu te order-i.
6. Kliko `Start WMS`.
7. Kliko `Perfundo WMS`.
8. Te seksioni `Krijo fature shitje`, lere aktiv `Posto menjehere`.
9. Zgjidh serine e fatures dhe metoden e pageses.
10. Kliko `Krijo / posto faturen`.

Pas kesaj hapet fatura e shitjes dhe duhet te jete `POSTED`.
