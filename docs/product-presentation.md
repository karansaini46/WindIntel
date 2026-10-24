# WindIntel — Client Product Presentation
*UK Wind Forecast Intelligence Platform — Executive Presentation (5-Minute Walkthrough)*

---

## Slide 1: The Business Problem
### Why Wind Forecast Accuracy Dictates Day-Ahead Trading Success
* **The Balancing Challenge:** As a UK electricity utility, we must purchase power from the wholesale market (EPEX SPOT / Nord Pool) at day-ahead gate closure to meet consumer demand.
* **The Wind Uncertainty Factor:** Wind generation significantly lowers our wholesale procurement costs, but wind is inherently variable and unpredictable.
* **The Cost of Uncertainty:**
  * **Overforecasting Risk:** If we assume 10,000 MW of wind will arrive tomorrow and only 8,000 MW generates, we are left short 2,000 MW in real-time, incurring punitive system buy-price imbalance cashout penalties.
  * **Underforecasting Risk:** If we underestimate wind, we needlessly purchase expensive thermal/gas peaker contracts at peak day-ahead rates that we ultimately do not need, spilling energy or selling back into an oversupplied market at depressed prices.
* **The Core Need:** Day-ahead traders need to know: *What was the best forecast we actually had when we locked in our orders, how accurate was it historically, and where are our systematic model biases?*

---

## Slide 2: The Solution
### WindIntel: Day-Ahead Wind Forecast Intelligence
* **What It Is:** An analytics and decision-support platform purpose-built for GB power market trading and procurement desks.
* **Primary Source of Truth:** Direct, transparent integration with official Elexon Insights Solution (BMRS) feeds:
  * `FUELHH`: Metered outturn generation across Great Britain.
  * `WINDFOR`: Consecutive forecast evolution runs published by the National Energy System Operator (NESO).
* **Core Value Proposition:**
  1. Reconstructs exact historical decision-time constraints (zero information leakage).
  2. Quantifies real-world forecast uncertainty across delivery dates and diurnal settlement periods.
  3. Uncovers systematic model biases (overforecasting vs. underforecasting).
  4. Provides complete transparency down to individual 30-minute settlement intervals.

---

## Slide 3: The User Workflow
### Reconstructing Market Realities in Three Clicks
1. **Select Decision Date ($D$):** Choose any trading day in January 2026 (e.g., 5 January 2026).
2. **Configure Decision Cutoff ($T_{\text{cutoff}}$):** Set the operational day-ahead order book closure (e.g., 12:00:00 GMT for the GB Half-Hour Auction).
   * *Algorithm Guarantee:* The platform strictly considers forecasts published at or before 12:00:00 GMT on 5 January, completely excluding subsequent revisions published after trading closed.
3. **Analyze Delivery Day ($D+1$):**
   * Inspect the forecast profile available for physical delivery on 6 January 2026.
   * Compare against verified metered outturn data.
   * Drill into interval revisions using the Forecast Publication Evolution drawer.

---

## Slide 4: Understanding Uncertainty
### The Language of Risk for Procurement Desks
| Metric | Observed (e.g. 6 Jan 2026) | Operational Interpretation |
| :--- | :--- | :--- |
| **MAE** *(Mean Absolute Error)* | **1,726 MW** | On average, wind generation deviated by 1.72 GW from our purchasing baseline. This establishes the volume of flexible balancing reserves required. |
| **RMSE** *(Root Mean Squared Error)* | **2,059 MW** | Penalizes severe forecast misses quadratically. The spread between RMSE and MAE (333 MW) highlights volatility during rapid weather front arrivals. |
| **Forecast Bias** | **+1,376 MW (Overforecasting)** | **Critical Operational Warning:** Models consistently overestimated wind generation by ~1.38 GW across the day. Traders relying on raw forecasts would have faced significant shortfall cashout costs. |
| **MAPE** | **29.5%** | Percentage error across standard wind generation intervals (calm periods < 100 MW excluded to prevent percentage distortion). |
| **Coverage** | **24/48 Periods (50%)** | NESO publishes hourly WINDFOR forecasts against 48 half-hourly settlement periods. WindIntel preserves data integrity without synthetic interpolation. |

---

## Slide 5: Operational Case Study
### 6 January 2026: Diagnosing Systematic Overforecasting
* **The Scenario:** On 5 January at 12:00 GMT, day-ahead forecasts projected sustained afternoon wind generation peaking at **15,869 MW** (SP 45, 22:30 GMT).
* **The Outturn:** Actual wind outturn peaked earlier and plateaued lower, with actual generation coming in at **16,374 MW** later at night but lagging forecasts significantly during mid-day intervals.
* **Financial Impact of Uncalibrated Bidding:**
  * Systematically bidding the uncalibrated WINDFOR forecast would have left our utility short by over 1,000 MW during morning peak hours (SP 15–20).
  * With WindIntel's Bias alert (+1,376 MW), procurement managers can dynamically haircut raw forecast volumes before placing day-ahead auction orders, saving hundreds of thousands of pounds in balancing mechanism penalties.

---

## Slide 6: Boundaries, Limitations & Next Steps
### Scope Discipline & Roadmap to Commercial Optimization
* **Current Boundaries (By Design):**
  * Strictly restricted to national GB wind generation from Elexon BMRS.
  * Intentionally excludes consumer demand, solar generation, electricity wholesale prices, and imbalance cashout price feeds.
  * Does not claim to compute net utility procurement requirements without customer load profiles.
* **Recommended Next Steps for Full Commercial Deployment:**
  1. **Demand & Solar Fusion:** Combine WindIntel with national solar and consumer demand datasets to calculate net system demand.
  2. **Imbalance Price Integration:** Overlay cashout prices (SSP/SBP) to quantify historical financial losses from forecast errors.
  3. **Probabilistic Reserve Sizing:** Utilize historical error percentiles (P10/P50/P90) to automate reserve capacity buffers in battery and peaker contracts.
