# Assignment 3: Supply Chain Manager Analysis

*Draft for discussion; proposed judgments require review. Measurements come from saved submission runs.*

The submission retains the original 27-node planner/Switch topology, uses Sonnet 4.6, and executes one branch per goal. The connected experiment remains separate.

## 1. Algorithm comparison

Execution 41 provides an instructive comparison between SKU-007, Wool Gloves, and the more stable SKU-011, Stainless Bottle. Both use the same classical algorithm: the latest three-month mean multiplied by the target calendar month's historical seasonal index. This is reproducible, but it assumes recent demand and historical seasonality remain useful predictors.

For Gloves, the displayed moving average was **376.7 units**, with seasonal index **0.94**, producing a rounded baseline of **354 units**. The LLM revised this to **518 units**, a **46.33% increase**. Its evidence was the supplied sales history: October, November and December sales were 218, 394 and 518. The recent mean exceeded 2.5 times the prior-period mean, triggering the generic spike observation. The prompt treated the latest observed month as a continuation scenario, with an explicit warning that persistence was uncertain. It did not invent a promotion or claim to have measured future demand.

For Bottle, the displayed moving average was **76**, the displayed seasonal index **0.98**, and the baseline **75 units**; the calculation uses unrounded intermediate values. The LLM retained **75**, explaining that neither a spike nor sustained decline justified an override. Its lack of intervention matters: contextual reasoning should not manufacture changes to demonstrate activity.

For the next Gloves replenishment decision, I would use 518 as a provisional risk-planning scenario rather than rely solely on 354, because the baseline smooths a rapidly rising series and then applies historical seasonality. However, neither value establishes forecast accuracy: there is no held-out future observation, only twelve historical months. I would review spike persistence and seasonal explanations before committing stock. For Bottle, I would trust the unchanged classical baseline more because the recent series is stable and the LLM adds no independent evidence.

These judgments do not mean the submission automatically feeds 518 into EOQ. Its original branches are independent: inventory uses historical annual demand. The comparison illustrates a limitation of the classical assumptions, not a proven causal effect or a validated improvement in forecast error. Scenario checks retain original model values if corrections are needed; execution 41 required none.

## 2. EOQ assumption analysis

EOQ implements `round(sqrt(2*D*S/H))`, with ordering cost USD 50 and historical annual demand. Zero or invalid demand/holding-cost inputs return zero. Its arithmetic can be correct while its assumptions are unsuitable.

I implemented four flags:

- **viral_spike:** latest three-month mean exceeds 2.5 times the preceding nine-month mean. SKU-007 triggers it. In execution 43 the model proposed **539 units**, while its explanation contradicted that quantity. The policy validator produced **736**, using the greater of a 25% EOQ uplift and uncovered lead-time-plus-30-day demand. I agree with emergency review, but regard that quantity as a heuristic requiring human confirmation.
- **declining:** latest three-month mean is below half the first three-month mean. SKU-013 triggers it. The model recommended **markdown, no reorder**, which the validator retained. With 540 units on hand and falling demand, I agree; decline alone does not justify claiming discontinuation or liquidating stock.
- **low_velocity:** historical annual demand below **60 units**. No original SKU triggers it. Controlled tests covered low-volume input; I cannot present an original-data example. The intended response is a small uncovered monthly replenishment or hold, rather than mechanically ordering EOQ.
- **long_lead_time:** lead time above **28 days**, with population coefficient of variation above **0.5**. Thermal Jacket, SKU-006, triggers it. The raw model said hold despite describing reorder exposure; validation corrected this to **147 units**. I agree with reviewing the gap, while recognizing seasonal overstock risk.

Multiple flags can coexist. Perishability was omitted because the demo products are non-perishable; a real deployment would need shelf-life constraints. The thresholds are explicit screening choices, not calibrated probabilities.

## 3. Supplier rubric defense

The assumed business is Coastal Goods, a direct-to-consumer e-commerce retailer. My weights total **100%: reliability 35%, quality 25%, lead time 25%, and cost 15%**. Missed deliveries and defective goods directly threaten customer service, so reliability and quality together outweigh cash-flow flexibility. A hospital would require stronger safety and continuity constraints than this retail rubric.

The cost measure is explicitly a **payment-terms proxy**, not purchase price. Fixed scoring anchors make comparisons independent of roster composition: 60-day payment terms, 42-day lead-time scale, 70%-100% on-time scale, and 0%-5% defect scale. Components are clamped and rounded weighted points. These anchors and tier cutoffs are policy assumptions worth sensitivity-testing.

In execution 42, the **validated** leader was **GreenLeaf Goods, 80.83/100**, and the lowest was **Pacific Rim Trading, 53.66/100**. This matches my expectation: GreenLeaf's seven-day lead time, 97% on-time rate and 0.8% defects outweigh Pacific Rim's more favorable payment terms.

This was not flawless LLM arithmetic. Five supplier rows needed component, total or tier corrections. Final Output retained reported scores and flagged affected recommendations for review. The rubric interpretation is useful; its numerical execution should be independently checked.

## 4. Run metrics

These were genuine end-to-end runs: only the goal changed, the planner selected `next_subgoal`, and the original Switch executed one branch. Each used two LLM calls: planner plus a batched leaf request. Tokens include both calls, not merely the leaf output.

| Branch | Execution | Total tokens | Estimated USD | Seconds |
|---|---:|---:|---:|---:|
| Forecast | 41 | 5,138 | 0.029106 | 18.479 |
| Inventory | 43 | 7,047 | 0.038385 | 27.234 |
| Supplier | 42 | 3,472 | 0.020028 | 17.118 |
| Logistics | 40 | 3,362 | 0.016998 | 14.084 |

Estimates use [recorded pricing and usage](tests/run-metrics.json): Sonnet 4.6 input USD 3/million and output USD 15/million, checked 17 October 2026 against [Anthropic's pricing](https://platform.claude.com/docs/en/about-claude/pricing). No cache tokens were reported. These are estimates, not invoices, and exclude development failures. Batching kept every measured run below USD 0.10. The main surprise was that valid structured JSON still contained incorrect numbers and contradictory explanations.

## 5. The four primer questions

1. **Classical error versus LLM error:** Gloves' 354-unit baseline lagged the observed spike; the LLM proposed the 518-unit continuation scenario. Conversely, classical validation caught supplier arithmetic errors and inventory fields contradicting their explanations. “Wrong” here means assumption or policy mismatch, not measured future forecast error.
2. **Unknown planner route:** An unsupported value such as `audit_warehouse` can otherwise leave the Switch without a matching branch. The response schema restricts the enum, and Parse Plan rejects unsupported or inconsistent routes before dispatch. This failure was tested.
3. **Declining Earbuds:** EOQ returns **397 units** from historical demand despite falling sales and excess stock. The `declining` flag prevents interpreting that mathematically valid batch size as an automatic reorder; the exception response recommends markdown instead.
4. **Why divide the work:** LLMs help articulate competing supplier criteria and contextual trade-offs; fixed EOQ arithmetic belongs in code. Swapping responsibilities would add numerical uncertainty to EOQ and require manually specifying every qualitative supplier rule. Even supplier scoring's fixed arithmetic warrants classical validation.

The planner's worked examples also make dependencies explicit: forecasting precedes forecast-driven replenishment, while a standalone supplier review can use existing KPIs immediately.

## Demo video

Not yet recorded. Add the reviewed video link here before submission.

