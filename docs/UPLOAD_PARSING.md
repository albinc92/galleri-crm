# Excel Upload & Parsing Documentation

## Overview

The Galleri CRM imports customer data from Excel files. The current implementation reads specific column headers and maps them to the database schema.

---

## Expected Excel Column Mappings

### Customer Fields (Required marked with *)

| Excel Column | Database Field | Notes |
|-------------|----------------|-------|
| `Kundnr` * | `kundnr` | Unique identifier. If missing, auto-generates `K001`, `K002`, etc. |
| `Namn` * | `foretagsnamn` | Company/organization name |
| `Aktiv kund` | `aktiv` | Values: `JAA`, `NJA`, `NEJ`. Defaults to `NEJ` |
| `Adress` | `adress` | Street address |
| `Postnr` | `postnummer` | Postal code (used for Swedish filter: 5 digits) |
| `Postadress` | `stad` | City name |
| `Telefon` | `telefon` | Company phone number |
| `Nästa besök` | `bokat_besok` | If any value exists → `true`, otherwise `false` |

### Notes Field (Combined from multiple columns)

These columns are merged into the `anteckningar` (notes) field:
- `Intresse` → Prefixed with "Intresse: "
- `Köpt vad` → Prefixed with "Köpt: "
- `Köpt vad innan` → Prefixed with "Tidigare köp: "
- `Text email Erbjudande 1` → Prefixed with "Erbjudande 1: "
- `Text email Erbjudande 2` → Prefixed with "Erbjudande 2: "

### Ordförande (Chairman) Contact

| Excel Column | Database Field |
|-------------|----------------|
| `Namn Ordförande` | `namn` |
| `Email Ordförande` | `email` |
| `Tel ordförande` | `telefon` |
| `Mobil Ordförande` | `mobil` |
| `Kontakt Ordf` | `senast_kontakt` (date) |
| `Återkom Ordförande` | `aterkom` (date) |

### Kassör (Treasurer) Contact

| Excel Column | Database Field |
|-------------|----------------|
| `Namn Kassör` | `namn` |
| `Email Kassör` | `email` |
| `Tel kassör` | `telefon` |
| `Mobil Kassör` | `mobil` |
| `Kontakt Kassör` | `senast_kontakt` (date) |
| `Återkom Kassör` | `aterkom` (date) |

### Ansvarig (Responsible) Contact

| Excel Column | Database Field |
|-------------|----------------|
| `Namn Ansvarig 1` | `namn` |
| `Email Ansvarig 1` | `email` |
| `Tel Ansvarig 1` | `telefon` |
| `Mobil Ansvarig 1` | `mobil` |
| `Kontakt Ansv 1` | `senast_kontakt` (date) |
| `Återkom Ansv 1` | `aterkom` (date) |

### Sales Data

| Excel Column | Database Field |
|-------------|----------------|
| `Senaste besök` | `datum` (date) |
| `Köpt vad` | `sald_konst` (what was sold) |

*Note: Sales are only created if BOTH `Köpt vad` AND `Senaste besök` have values.*

---

## Current Error Handling

### What Currently Happens

1. **Duplicate `kundnr`**: Silently skipped (PostgreSQL unique constraint error `23505`)
2. **Missing required fields**: Row is processed anyway with empty values
3. **Invalid dates**: The `excelDateToISO()` function attempts to parse, returns `null` if invalid
4. **Contact/Sales insert failures**: Logged but doesn't stop the import

### Current Limitations

- ❌ No pre-validation (dry run)
- ❌ No report of which rows had issues
- ❌ No way to identify exact Excel row numbers in errors
- ❌ Duplicates are silently skipped, not reported
- ❌ Empty `foretagsnamn` is allowed (creates useless records)

---

## Known Data Quality Issues

Based on the ~5000 customer dataset:

1. **Duplicate `Kundnr` values** - Same customer number appears multiple times
2. **Inconsistent phone formats** - Mix of formats: `08-123456`, `08123456`, `+46 8 123456`
3. **Invalid/malformed emails** - Missing `@`, typos, incomplete addresses
4. **Date format inconsistencies** - Mix of Excel serial numbers, `YYYY-MM-DD`, `DD/MM/YYYY`
5. **Missing company names** - `Kundnr` exists but `Namn` is empty
6. **Non-Swedish postal codes** - Foreign customers mixed in

---

## Recommended: Dry Run Validation Feature

### Proposed Functionality

Add a "Validate" button that:
1. Parses the Excel file
2. Checks every row for issues
3. Generates a downloadable error report
4. Does NOT insert anything into the database

### Validation Rules to Implement

| Rule | Severity | Description |
|------|----------|-------------|
| Missing `Kundnr` | Warning | Will auto-generate, but should be explicit |
| Duplicate `Kundnr` | Error | Will fail on insert |
| Missing `Namn` | Error | Creates unusable record |
| Invalid email format | Warning | Won't break import but won't be useful |
| Invalid phone format | Warning | Won't break import |
| Invalid date format | Warning | Will be stored as `null` |
| Empty row | Warning | Row with no useful data |

### Error Report Format

```
VALIDATION REPORT - 2026-01-29
==============================
Total rows: 5234
Valid rows: 4892
Rows with errors: 156
Rows with warnings: 412

ERRORS (must fix before import):
---------------------------------
Row 45: Duplicate Kundnr "K1234" (also on row 12)
Row 89: Missing company name (Namn)
Row 234: Duplicate Kundnr "K5678" (also on rows 45, 156)
...

WARNINGS (will import but may have issues):
-------------------------------------------
Row 12: Invalid email "anna.svensson@" 
Row 34: Unusual date format "2023/05/12" - parsed as 2023-05-12
Row 56: Phone number has letters "08-GALLERI"
...
```

---

## Decision: Fix Data or Add Dry Run?

### Option A: Ask Customer to Fix Data
**Pros:**
- Cleaner data long-term
- No additional development needed
- Customer learns to maintain data quality

**Cons:**
- Customer may not have Excel skills
- Time-consuming for them
- May create friction

### Option B: Add Dry Run Feature
**Pros:**
- Self-service for customer
- Identifies exact rows to fix
- Can be reused for future imports
- Professional user experience

**Cons:**
- Development time (~2-4 hours)
- Ongoing maintenance

### Option C: Both (Recommended)
1. Implement dry run feature
2. Customer runs validation
3. Export error report
4. Customer fixes major issues (duplicates, missing names)
5. Re-validate until clean
6. Final import

---

## Implementation Estimate

| Feature | Time | Priority |
|---------|------|----------|
| Dry run validation | 2 hours | High |
| Downloadable error report | 1 hour | High |
| Duplicate detection | 30 min | High |
| Email format validation | 30 min | Medium |
| Phone format validation | 30 min | Low |
| Date format detection | Already done | - |

**Total: ~4-5 hours for full validation feature**
