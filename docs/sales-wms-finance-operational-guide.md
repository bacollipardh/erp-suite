# Sales, WMS, Finance - Operational Guide

## Qellimi

Ky dokument shpjegon rrjedhen operative te shitjes nga porosia/fatura deri te stoku, WMS, financa dhe kartela e bleresit.

## Rrjedha standarde me WMS

Perdoret kur dalja fizike duhet te kontrollohet nga magazina.

1. Krijohet fatura e shitjes ose krijohet nga Agent Order.
2. WMS krijon rezervimet per artikujt.
3. Picker konfirmon picking.
4. Packing kompletohet.
5. Fatura postohet.
6. Sistemi zbrit stock balance, zbrit WMS stock, krijon levizje `SHIP`, konton faturen dhe hap detyrimin e bleresit.

Statuset shihen ne faqen e fatures te blloku `Statusi WMS`:

- `Me WMS`: fatura ka workflow pick/pack.
- `Pick`: rezervimet jane marre nga lokacionet.
- `Pack`: malli eshte paketuar.
- `Ship`: stoku eshte dale nga WMS dhe finance/stoku jane postuar.

## Rrjedha pa WMS

Perdoret vetem kur malli del pa proces pick/pack, p.sh. cash-and-carry, shitje direkte ne sportel ose rast operacional i kontrolluar.

1. Perdoruesi aktivizon `Posto pa WMS`.
2. Perdoruesi shkruan arsyen.
3. Fatura postohet pa krijuar task-a WMS.
4. Sistemi zbrit stock balance dhe WMS stock direkt nga lokacionet e disponueshme.
5. Sistemi krijon rezervim `SHIPPED` dhe levizje WMS `SHIP` per gjurme.
6. Sistemi konton faturen dhe perditeson kartelen e bleresit.

Rregull sigurie: nese fatura ka task ose rezervim WMS aktiv, bypass nuk lejohet. Duhet te perfundohet ose lirohet WMS para postimit pa WMS.

## Agent Orders

Agent Order perdoret kur agjenti krijon porosi per bleres/objekt dhe magazina duhet ta marre punen.

Rrjedha:

1. Agjenti krijon order.
2. Order caktohet te picker.
3. Picker e nis dhe e kompleton WMS.
4. Nga order krijohet fatura.
5. Fatura postohet dhe merr efekt financiar/stok.

Kjo rrjedhe duhet te mbetet me WMS sepse ka perzgjedhje picker-i dhe kontroll operacional.

## Kthimet e shitjes

Kthimi lidhet me faturat e shitjes.

Rrjedha:

1. Zgjedhet fatura origjinale.
2. Zgjedhen rreshtat dhe sasite per kthim.
3. Nese politika e aprovimit e kerkon, krijohet approval request.
4. Pas aprovimit, kthimi postohet.
5. Stoku rritet dhe kartela e bleresit merr efekt kreditues.

## Pagesat dhe kartela e bleresit

Pas postimit:

- fatura hap detyrim te bleresit;
- arketimi regjistrohet nga fatura ose faqja e dedikuar e arketimit;
- `amountPaid`, `paymentStatus`, `outstandingAmount` dhe historiku i pagesave perditesohen;
- librat e medhenj te klienteve dhe raportet e arketueshme lexojne kete gjendje.

## Audit trail

Postimi pa WMS ruan gjurme te dyfishta:

- `POST` me `wmsMode: BYPASS`;
- `WMS_BYPASS_POST` me arsyen, user-in, magazinen, numrin e rreshtave dhe sasine totale.

Nga faqja e fatures mund te hapet `Audit` per ta pare gjurmen.

## Testet operative

Komandat kryesore:

```powershell
docker compose run --rm backend npm run prisma:seed
npm run smoke:pos-wms
npm run smoke:pos-no-wms
npm run smoke:agent-wms
npm run smoke:full
```

`smoke:pos-wms` verifikon fature me WMS.

`smoke:pos-no-wms` verifikon fature pa WMS dhe kontrollon qe arsyeja del te `wmsSummary`.

`smoke:agent-wms` verifikon Agent Order -> WMS -> fature e postuar.

`smoke:full` verifikon shitje, kthim, pagesa, financa, approval, raporte dhe frontend proxy.
