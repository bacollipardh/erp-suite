# Mobile Agent and Picker Operations

Ky dokument pershkruan pjesen mobile qe lidhet 100% me ERP web/backend: agjenti krijon porosi, pickeri ekzekuton WMS task-et, supervisor-i monitoron exception-et dhe sistemi i financon dokumentet pas finalizimit.

## Hyrjet Kryesore

- Mobile app: `mobile/`
- Dashboard web: `/mobile-operations`
- Agent orders web: `/agjenti/orders`
- WMS tasks web: `/wms/tasks`
- Smoke test: `npm run smoke:mobile-agent-picker`

## Agjenti

Agjenti mund te:

- krijoje order nga telefoni;
- zgjedhe klientin, objektin, magazinen dhe tipin e order-it;
- shtoje linja artikujsh me sasi dhe cmim;
- ruaje draft offline kur API nuk eshte e qasshme;
- dergoje draftet e ruajtura kur kthehet lidhja;
- shikoje statusin e order-it deri te krijimi i fatures;
- klonoje order ekzistues per porosi te perseritura.

Order-i pastaj hyn ne workflow: `DRAFT/SUBMITTED -> WMS_ASSIGNED -> PICKING -> READY_FOR_DOCUMENT -> DOCUMENT_CREATED`.

## Picker

Picker-i mund te:

- shikoje task-et e caktuara;
- hap task-un me detaje te lokacionit, artikullit, lotit, serialit dhe skadences;
- skanoje ose shkruaje lokacionin;
- skanoje ose shkruaje barkodin/kodin e artikullit;
- konfirmoje sasine e picked;
- regjistroje partial pick;
- regjistroje short me arsye dhe shenim;
- ruaje pick/short/pack offline;
- sinkronizoje offline queue kur API eshte gati;
- finalizoje krejt faturen ose agent order-in kur task-et jane mbyllur.

## Supervisor

Supervisor-i ne mobile dhe web mund te:

- ricaktoje task te picker tjeter;
- rihape task te bllokuar;
- mbylle task me vendim operativ;
- shikoje exception queue ne `/mobile-operations`;
- shikoje audit trail per start, pick, short, pack dhe finalizim.

## Njoftimet

Mobile home llogarit sinjalet operative:

- WMS task te bllokuara;
- WMS task short;
- agent orders gati per fature;
- draft queue e agjentit;
- picker offline queue.

Butoni `Aktivizo Njoftimet` kerkon lejen e pajisjes dhe aktivizon local notification hooks. Push token merret kur Expo project id eshte i konfiguruar gjate build-it final.

## Testimi

Nga root i projektit:

```powershell
npm run smoke:mobile-agent-picker
```

Ky test krijon agent order, e dergon ne WMS, kryen pick task-et, finalizon order-in, krijon dhe poston faturen, pastaj teston edhe nje rast exception/short.

Per build web/mobile lokal:

```powershell
npm run build --prefix frontend
cd mobile
npm run typecheck
```

Per EAS build final duhet Expo login aktiv:

```powershell
cd mobile
npx eas-cli login
npm run build:android:preview
```

## Cfare Duhet Kontrolluar Para Final App Builds

- API URL ne mobile duhet te jete URL e backend-it qe telefoni e arrin nga rrjeti.
- Docker backend/frontend/database duhet te jene `up`.
- `npm run smoke:mobile-agent-picker` duhet te kaloje.
- Ne `/mobile-operations` nuk duhet te kete exception te pazgjidhura.
- Expo account duhet te jete i loguar per EAS build.
