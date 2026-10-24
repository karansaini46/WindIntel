# WindIntel — Data Methodology Documentation

## 1. Overview and Executive Summary
WindIntel is an energy-market intelligence platform designed for UK electricity utilities participating in day-ahead wholesale electricity markets. Day-ahead procurement requires estimating available wind generation for the upcoming delivery day to determine required balancing power from conventional sources.

This document details the data methodology, upstream API contracts, timestamp conventions, resolution alignments, forecast-selection algorithm, and error evaluation metrics implemented in WindIntel.

---

## 2. Upstream Data Sources (Elexon BMRS)

WindIntel integrates directly with the official Elexon Insights Solution (formerly BMRS) REST API:
- **Base URL:** `https://data.elexon.co.uk/bmrs/api/v1`
- **Authentication:** Publicly accessible open data; no API key required.
- **Specification:** OpenAPI 3.0 documented at `https://data.elexon.co.uk/swagger/v1/swagger.json`.

### 2.1 Actual Wind Generation (`FUELHH`)
- **Primary Endpoint:** `GET /datasets/FUELHH`
- **Stream Alternative:** `GET /datasets/FUELHH/stream`
- **Filter Applied:** `fuelType=WIND`
- **Query Parameters:**
  - `settlementDateFrom` (YYYY-MM-DD): Start date of settlement window.
  - `settlementDateTo` (YYYY-MM-DD): End date of settlement window (maximum 7-day span).
  - `fuelType` (string): Set to `WIND` to extract metered wind generation.
- **Key Schema Attributes:**
  - `startTime` (ISO-8601 UTC string, e.g., `2026-01-06T00:00:00Z`): The start of the 30-minute settlement period.
  - `settlementDate` (YYYY-MM-DD): Delivery date in the Great Britain electricity system.
  - `settlementPeriod` (integer, 1–48): The 30-minute settlement period index (1–46 on short DST days, 1–50 on long DST days).
  - `fuelType` (string): Category of fuel (`WIND`, `NUCLEAR`, `CCGT`, `BIOMASS`, etc.).
  - `generation` (integer / int64): Generation outturn aggregated across metered wind generation units.
- **Generation Unit:** **Megawatts (MW)**. Represents average power delivered across the 30-minute settlement interval.

### 2.2 Wind Generation Forecasts (`WINDFOR`)
- **Primary Endpoint:** `GET /datasets/WINDFOR`
- **Stream Alternative:** `GET /datasets/WINDFOR/stream`
- **Query Parameters:**
  - `publishDateTimeFrom` (ISO-8601 UTC string)
  - `publishDateTimeTo` (ISO-8601 UTC string, maximum 7-day span)
- **Key Schema Attributes:**
  - `startTime` (ISO-8601 UTC string): The delivery interval timestamp being forecast.
  - `publishTime` (ISO-8601 UTC string): The timestamp when the National Energy System Operator (NESO) published this forecast version.
  - `generation` (integer / int64): Forecasted wind generation value in **Megawatts (MW)**.
- **Evolution / Version History Endpoint:** `GET /forecast/generation/wind/evolution?startTime={delivery_startTime}`
  - Used to fetch the complete chronological publication revision history for any specific delivery interval.

---

## 3. Upstream API Constraints & Ingestion Rules

### 3.1 Maximum 7-Day Date Range Constraint
The Elexon BMRS API strictly enforces a maximum 7-day query window. Submitting requests where:
$$\text{settlementDateTo} - \text{settlementDateFrom} > 7 \text{ days}$$
or
$$\text{publishDateTimeTo} - \text{publishDateTimeFrom} > 7 \text{ days}$$
immediately fails with `HTTP 400 Bad Request`:
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "": ["The date range between SettlementDateFrom and SettlementDateTo inclusive must not exceed 7 days"]
  }
}
```
**Architecture Solution:**
The WindIntel ingestion service partitions requests into chunks of at most 5–7 days, issues batched requests with bounded concurrency, and caches normalized responses in a local SQLite database (`windintel.db`).

### 3.2 Granularity & Interval Alignment (Hourly vs. Half-Hourly)
A fundamental characteristic of the Elexon dataset verified directly against live API responses:
- `FUELHH` (Actuals) is reported at **30-minute (half-hourly)** resolution (48 settlement periods per normal day). Every record explicitly provides `startTime` (with `:00` and `:30` minute values), `settlementDate`, `settlementPeriod` (1–48), and `generation` (MW).
- `WINDFOR` (Forecasts) is published by National Energy System Operator (NESO) strictly at **60-minute (hourly)** resolution.
  - Every forecast record's `startTime` occurs at minute `:00` (e.g. `00:00:00Z`, `01:00:00Z`, ..., `23:00:00Z`). In GB electricity settlement terms, these correspond to the odd-numbered settlement periods: SP 1, SP 3, SP 5, ..., SP 47.
  - `WINDFOR` responses contain only `{'dataset', 'publishTime', 'startTime', 'generation'}` without explicit `settlementPeriod` or `settlementDate` fields.
  - In the Elexon/NESO data convention, `generation` represents the expected average wind generation (MW) over that 60-minute interval starting at `startTime`.
  - The API does **not** provide records for the intervening `:30` half-hours (SPs 2, 4, 6, ..., 48). When querying the `/forecast/generation/wind/evolution` endpoint with a half-hourly timestamp (such as `12:30:00Z`), the upstream Elexon engine explicitly maps it back to the hourly forecast starting at `12:00:00Z` (Settlement Period 25).
  - The WindIntel parser does **not** ignore any records: every record returned by `/datasets/WINDFOR` is processed and validated.

**Strict Data Integrity Rules:**
1. **No Silent Interpolation:** We do **not** artificially synthesize or interpolate forecasts for `:30` settlement periods. Fabricating data would corrupt the evaluation of NESO's official day-ahead forecasts.
2. **Explicit Denominators & Coverage:**
   - On a native 30-minute settlement interval grid, expected delivery intervals = 48.
   - Forecast intervals available from WINDFOR = 24.
   - Actual intervals available from FUELHH = 48.
   - Matched forecast-actual pairs = 24.
   - Missing forecast intervals = 24 (50.0% coverage).
   - Missing actual intervals = 0.
3. **No Unpaired Metrics:** Metrics (MAE, RMSE, Bias, MAPE) are calculated **strictly on matched forecast-actual pairs**. Under no circumstances are missing forecasts or missing actuals coerced to 0 MW.

### 3.3 Historical Retrieval Lookback Strategy
- To evaluate purchasing decisions made at day-ahead cutoff $T_{\text{cutoff}}$, the ingestion service queries forecasts published across $[T_{\text{cutoff}} - 5\text{ days}, T_{\text{cutoff}} + 1\text{ hour}]$.
- **Why 5 Days:** NESO issues wind forecasts up to 2–5 days prior to physical delivery. Bounding the publication query to $[T_{\text{cutoff}} - 5\text{d}, T_{\text{cutoff}} + 1\text{h}]$ ensures that earlier revisions are captured even if no newer revision was published within 48 hours of cutoff, while staying well within Elexon's 7-day query ceiling.
- **Deep Historical Evolution Auditing:** For any specific delivery interval, the `/forecast/generation/wind/evolution?startTime={start_time}` endpoint retrieves the complete multi-day revision history (e.g. 24 revisions published between 57 hours and 10 hours prior to delivery), and applies the exact same cutoff filter $T_{\text{pub}} \le T_{\text{cutoff}}$ to guarantee 100% selection consistency.

---

## 4. The Historical Purchasing Decision Model

### 4.1 Target Period
- **Decision Dates:** 1 January 2026 through 31 January 2026.
- **Target Delivery Day:** The following calendar day ($D+1$).
  For example, selecting decision date `2026-01-05` evaluates delivery intervals occurring on `2026-01-06` (from `00:00:00` to `23:30:00` Europe/London).

### 4.2 Configured Decision Cutoff
In the GB wholesale electricity market, day-ahead auction order books close mid-day (typically 11:00 or 12:00 local time).
- **Default Cutoff:** `12:00:00` Europe/London (12:00 PM local time).
- **Configurability:** Fully configurable via the `DECISION_CUTOFF` environment variable or dynamically via frontend filter controls.
- **Operational Classification:** Labelled transparently as an *illustrative operational day-ahead purchasing cutoff* rather than an official regulatory gate closure.

### 4.3 Timestamp Definitions & Distinction
| Concept | Definition | Example |
| :--- | :--- | :--- |
| **Decision Date ($D$)** | The calendar date on which trading and procurement decisions are executed. | `2026-01-05` |
| **Decision Cutoff ($T_{\text{cutoff}}$)** | The exact cutoff timestamp on date $D$. Forecasts published after this cutoff are legally/operationally unavailable for the decision. | `2026-01-05T12:00:00Z` |
| **Delivery Date ($D+1$)** | The calendar date when electricity is physically delivered and consumed. | `2026-01-06` |
| **Delivery Interval Start ($T_{\text{start}}$)** | The starting timestamp of the half-hour or hour settlement interval. | `2026-01-06T14:00:00Z` |
| **Publication Time ($T_{\text{pub}}$)** | When NESO generated and published that specific forecast revision. | `2026-01-05T11:30:00Z` |
| **Forecast Lead Time** | $T_{\text{start}} - T_{\text{pub}}$ (in hours). | 26.5 hours |

---

## 5. Forecast-Selection Algorithm

### 5.1 Formal Mathematical Formulation
Let:
- $\mathcal{I}$ be the set of delivery intervals for delivery day $D+1$:
  $$\mathcal{I} = \{ t \mid t \ge (D+1)\text{ 00:00}, t \le (D+1)\text{ 23:30} \}$$
- $\mathcal{F}$ be the set of all retrieved forecast records from `WINDFOR`, where each record $r \in \mathcal{F}$ is a tuple:
  $$r = (T_{\text{start}}, T_{\text{pub}}, \hat{y})$$
- $T_{\text{cutoff}}$ be the purchasing decision cutoff timestamp on decision date $D$.

For each delivery interval $t \in \mathcal{I}$:
1. **Eligibility Filter:**
   $$\mathcal{F}_{\text{eligible}}(t) = \{ r \in \mathcal{F} \mid r.T_{\text{start}} = t \land r.T_{\text{pub}} \le T_{\text{cutoff}} \}$$
2. **Latest Version Selection:**
   If $\mathcal{F}_{\text{eligible}}(t) \ne \emptyset$, select:
   $$r^*(t) = \operatorname{argmax}_{r \in \mathcal{F}_{\text{eligible}}(t)} (r.T_{\text{pub}}, \text{tie\_breaker}(r))$$
   Where `tie_breaker` deterministically picks the record with the latest ingestion ID if duplicate records share the identical publication timestamp.
3. **Information Leakage Prevention:**
   Any record with $r.T_{\text{pub}} > T_{\text{cutoff}}$ is strictly discarded from the decision evaluation. Actual generation $y_t$ is joined only **after** $r^*(t)$ is finalized.

---

## 6. Forecast Evaluation Metrics

Let $(F_i, A_i)$ be the $i$-th matched forecast-actual pair for $i = 1, \dots, N$.
The forecast error is defined as:
$$e_i = F_i - A_i$$

### 6.1 Mean Absolute Error (MAE)
$$\text{MAE} = \frac{1}{N} \sum_{i=1}^N |F_i - A_i|$$
- **Unit:** MW.
- **Interpretation:** Measures the average magnitude of error, regardless of direction. Lower is better.

### 6.2 Root Mean Squared Error (RMSE)
$$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N (F_i - A_i)^2}$$
- **Unit:** MW.
- **Interpretation:** Penalizes large outlier deviations more heavily due to quadratic squaring. Lower is better.

### 6.3 Mean Error / Bias
$$\text{Bias} = \frac{1}{N} \sum_{i=1}^N (F_i - A_i)$$
- **Unit:** MW.
- **Interpretation:**
  - $\text{Bias} > 0$: Systematic **overforecasting** (forecasted generation exceeds outturn). Operationally dangerous as the utility will under-procure alternative generation and face imbalance penalties.
  - $\text{Bias} < 0$: Systematic **underforecasting** (forecasted generation falls short of outturn).
  - $\text{Bias} \approx 0$: Minimal aggregate directional bias, though individual intervals may still exhibit large variances.

### 6.4 Mean Absolute Percentage Error (MAPE)
$$\text{MAPE} = \frac{1}{M} \sum_{i \in \mathcal{V}} \frac{|F_i - A_i|}{A_i} \times 100\%$$
Where:
- $\mathcal{V} = \{ i \mid A_i \ge A_{\text{threshold}} \}$ (with default $A_{\text{threshold}} = 100\text{ MW}$).
- $M = |\mathcal{V}|$ is the count of valid non-zero denominators.
- If $M = 0$, MAPE is displayed as `N/A`.
- The interface reports the number of excluded near-zero intervals to prevent distorted percentage inflation during calm wind regimes.

### 6.5 Forecast Coverage & Data Availability Accounting
For every evaluation window, WindIntel publishes an explicit audit matrix:
- **Expected Delivery Intervals ($N_{\text{exp}}$):** Standard 48 (or 46/50 during DST).
- **Available Forecast Intervals ($N_{\text{fc}}$):** Intervals with at least one eligible forecast.
- **Available Actual Intervals ($N_{\text{act}}$):** Intervals with verified outturn data in `FUELHH`.
- **Matched Pairs ($N$):** Valid pairs where both $F_i$ and $A_i$ exist.
- **Missing Forecast Count ($N_{\text{exp}} - N_{\text{fc}}$).**
- **Missing Actual Count ($N_{\text{exp}} - N_{\text{act}}$).**
- **Coverage Percentage:** $\frac{N}{N_{\text{exp}}} \times 100\%$.

All metrics explicitly cite $N$ as their evaluation base.
