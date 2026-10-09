# Apartment submeter workflow

Readings belong to the apartment meter, independently of tenants. A vacant apartment can have readings. Changing tenants does not reset the meter chain.

## Setup

1. Configure the property's electricity provider and an applicable provider or national tariff.
2. Configure the apartment as `Submeter`, payment responsibility `Owner collects`, and enter its meter number.
3. A tenant assignment is needed only when generating a rent bill, not when saving readings.

## Monthly steps

1. Open **Submeter Readings** in the dashboard navigation, or use the shortcut on **Electricity**.
2. A super administrator selects the owner first. Owners see their own properties. Select property, apartment and billing month.
3. Enter the current reading date and current reading. Previous reading and its date come from the latest earlier saved month for the same apartment and meter, including after tenant changes.
4. If no previous month exists, enter the opening reading and its date. Use **Add / update previous reading** to correct the baseline or enter a fresh baseline after a long gap. This changes the selected month only, not the earlier record.
5. Consumption = current minus previous. Meter charge reuses the previous saved charge or defaults to zero. Additional charges and adjustment are optional.
6. Optionally select **Calculate** to inspect units, lifeline/slabs, energy charge, meter charge, VAT and total. The property provider's tariff effective on the first day of the billing month is used, with national fallback. This calculates the submeter's consumption; it does not allocate a main-meter invoice between apartments.
7. Select **Save reading** or **Update reading**. Preview is optional; the server recalculates and saves the result.
8. Open **Generate rent bill**, select the apartment's tenant assignment and the same month, and prepare the bill. The saved apartment/month electricity amount is prefilled. Complete other charges, preview and generate the bill.
9. Rent Bill History and downloaded receipts preserve a snapshot of the meter readings and calculation.

Billing month is independent of reading dates: a September bill may use an October 1 current reading. The annual history shows dates, readings, units, amount and rent bill status; selecting a month opens its editable record. Reading entry is also available inside bill generation for apartments configured for owner-collected submeter electricity.

## Rules

- Owners can access readings only for their own properties. Super administrators can act for any owner. Tenant/general accounts cannot write readings.
- One saved reading per apartment and billing month; it can be updated. Revision checks reject stale edits.
- Both reading dates are required. Current reading must be at least previous reading, dates must be in order, and the current reading date cannot be in the future.
- Future billing months are blocked. Earlier months and gaps are allowed; the previous baseline can be corrected manually.
- Configure a new meter number and opening reading after a meter replacement/reset. A replacement does not erase historical readings.
- Saving or updating automatically refreshes electricity and totals on existing **due** rent bills for the same apartment/month. Paid receipts preserve their issued snapshot.
- Rent bill creation automatically takes the saved apartment/month electricity amount. If there is no saved reading, electricity remains null and prints blank on the receipt. Electricity is locked in the rent form; edit the submeter record to change it.

## APIs

All routes require an authenticated owner or super administrator.

- `GET /api/v1/electricity/submeter/context?apartmentId=...&billingPeriod=YYYY-MM`
- `POST /api/v1/electricity/submeter/preview`
- `POST /api/v1/electricity/submeter/readings` (create or update)
- `GET /api/v1/electricity/submeter/readings?apartmentId=...&year=2026`

POST body:

```json
{
  "reading": {
    "apartmentId": "...",
    "billingPeriod": "2026-10",
    "previousReading": 3317.82,
    "currentReading": 3325.64,
    "previousReadingDate": "2026-09-01",
    "currentReadingDate": "2026-10-01",
    "expectedRevision": null,
    "meterCharge": 0,
    "adjustmentAmount": 0
  }
}
```

The new `SubmeterReading` collection needs its unique `{apartmentId, billingPeriod}` index. Mongoose defines it in the schema; ensure indexes are created before accepting concurrent writes if deployment disables automatic index creation. Existing bills do not need a data migration. Send the loaded revision when updating (legacy records use revision 0). Older readings without dates must have dates filled in when edited; their historical dates are not guessed.

## Verification

Run `node --import tsx scripts/check-submeter.ts`. It exercises the real calculator with synthetic tariffs and mocked persistence, including consumption, slabs, VAT, fractional/zero usage, owner isolation, super administrator access, tenant independence, editable baselines, reading dates, revision conflicts, due-bill synchronization, and blank/automatic electricity in the actual rent bill service. It does not connect to a database. Backend build and frontend type/lint/build checks pass. Live account/database end-to-end verification requires running both updated applications.
