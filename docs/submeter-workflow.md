# Apartment submeter workflow

Readings belong to the apartment meter, independently of tenants. A vacant apartment can have readings. Changing tenants does not reset the meter chain.

## Setup

1. Configure the property's electricity provider and an applicable provider or national tariff.
2. Configure the apartment as `Submeter`, payment responsibility `Owner collects`, and enter its meter number.
3. A tenant assignment is needed only when generating a rent bill, not when saving readings.

## Monthly steps

1. Open **Submeter Readings** in the dashboard navigation, or use the shortcut on **Electricity**.
2. A super administrator selects the owner first. Owners see their own properties. Select property, apartment and billing month.
3. For the first reading of a meter, enter its opening reading. Later months automatically use the last saved current reading, including after tenant changes.
4. Enter the current reading. Consumption = current minus previous. Meter charge defaults to zero; enter any applicable charge and optional adjustment.
5. Select **Calculate** to inspect units, lifeline/slabs, energy charge, meter charge, VAT and total. The property provider's tariff effective on the first day of the billing month is used, with national fallback. This calculates the submeter's consumption; it does not allocate a main-meter invoice between apartments.
6. Select **Save apartment reading**. The server recalculates and saves the result.
7. Open **Generate rent bill**, select the apartment's tenant assignment and the same month, and prepare the bill. The saved apartment/month electricity amount is prefilled. Complete other charges, preview and generate the bill.
8. Rent Bill History and downloaded receipts preserve a snapshot of the meter readings and calculation.

Reading entry is also available inside bill generation for apartments configured for owner-collected submeter electricity.

## Rules

- Owners can access readings only for their own properties. Super administrators can act for any owner. Tenant/general accounts cannot write readings.
- Only one saved reading per apartment and month. Readings are immutable after saving; review the preview before saving. Financial corrections can use the rent bill's adjustment field.
- Current reading cannot be lower than previous. Previous reading must equal the last saved current reading for this apartment and meter number, regardless of tenant changes.
- Future months, months with an issued rent bill, and earlier months after a later reading has been saved are blocked.
- If months are missing, save them first. Otherwise all consumption since the last saved reading is assigned to the selected month; the UI displays a warning.
- Configure a new meter number and opening reading after a meter replacement/reset. A replacement does not erase historical readings.
- Rent bills for owner-collected submeter apartments require a saved reading and must use its electricity amount. That amount is locked in the form; corrections belong in the adjustment field.

## APIs

All routes require an authenticated owner or super administrator.

- `GET /api/v1/electricity/submeter/context?apartmentId=...&billingPeriod=YYYY-MM`
- `POST /api/v1/electricity/submeter/preview`
- `POST /api/v1/electricity/submeter/readings`

POST body:

```json
{
  "reading": {
    "apartmentId": "...",
    "billingPeriod": "2026-10",
    "previousReading": 3317.82,
    "currentReading": 3325.64,
    "meterCharge": 0,
    "adjustmentAmount": 0
  }
}
```

The new `SubmeterReading` collection needs its unique `{apartmentId, billingPeriod}` index. Mongoose defines it in the schema; ensure indexes are created before accepting concurrent writes if deployment disables automatic index creation. Existing bills do not need a data migration.

## Verification

Run `node --import tsx scripts/check-submeter.ts`. It exercises the real calculator with synthetic tariffs and mocked persistence, including consumption, slabs, VAT, fractional/zero usage, owner isolation, super administrator access, tenant independence, continuity and save guards. It does not connect to a database. Backend build and frontend type/lint/build checks pass. Live account/database end-to-end verification requires running both updated applications.
