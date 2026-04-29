# ERP Mobile

Mobile app i vërtetë për `iOS` dhe `Android`, i lidhur direkt me backend-in aktual `NestJS` të këtij repo-je.

## Çfarë përfshin aktualisht

- login me `JWT Bearer token`
- ruajtje e sigurt e sesionit me `expo-secure-store`
- role-based navigation për:
  - `Agjent`
  - `Picker / WMS`
- `Agent Orders` list + detail + workflow actions
- `Picker Tasks` list + start/complete/short/cancel
- `Scanner` me kamerë dhe query te `/wms/scan`

## Si niset

```bash
cd mobile
npm install
npm run start
```

## URL e backend-it

App-i kërkon URL-në e backend-it në ekranin e login-it.

Shembuj:

- Android emulator: `http://10.0.2.2:3000`
- iPhone simulator: `http://localhost:3000`
- Telefon real në të njëjtin rrjet: `http://IP-E-KOMPJUTERIT:3000`

Backend-i duhet të jetë i ngritur nga repo kryesor, p.sh. me Docker.

Shënim:

- backend-i NestJS i këtij projekti përdor `globalPrefix('api')`
- pra endpoint-et reale janë si `http://IP:3000/api/auth/login`
- në aplikacion mund të shkruash:
  - `http://IP:3000`
  - ose `http://IP:3000/api`
- app-i do ta normalizojë vetë te baza me `/api`

## Struktura

- `app/` - routes të Expo Router
- `src/providers/` - auth/session
- `src/lib/` - API client, permissions, formatting
- `src/components/` - UI e përbashkët mobile
