# Assignment 3: Supply Chain Manager Analysis

*Draft for discussion; proposed judgments require review. Measurements come from saved submission runs.*

The submission retains the original 27-node planner/Switch topology, uses Sonnet 4.6, and executes one branch per goal. The connected experiment remains separate.

## 1. Algorithm comparison

Execution 41 provides an instructive comparison between SKU-007, Wool Gloves, and the more stable SKU-011, Stainless Bottle. Both use the same classical algorithm: the latest three-month mean multiplied by the target calendar month's historical seasonal index. This is reproducible, but it assumes recent demand and historical seasonality remain useful predictors.

For Gloves, the displayed moving average was **376.7 units**, with seasonal index **0.94**, producing a rounded baseline of **354 units**. The LLM revised this to **518 units**, a **46.33% increase**. Its evidence was the supplied sales history: October, November and December sales were 218, 394 and 518. The recent mean exceeded 2.5 times the prior-period mean, triggering the generic spike observation. The prompt treated the latest observed month as a continuation scenario, with an explicit warning that persistence was uncertain. It did not invent a promotion or claim to have measured future demand.

However, the LLM followed a rule we provided in advance -- there is no independent evidence that the spike will persist, so the estimate should be treated as such. Conceptually, and I will preface by saying I am not supply chain manager, it feels like 518 is the risk of not having enough (i.e., probably an outside bound of what should be ordered based on taste and observable factors like the weather forcast), and the rounded baseline should probably be the minimum.

For Bottle, the displayed moving average was **76**, the displayed seasonal index **0.98**, and the baseline **75 units**; the calculation uses unrounded intermediate values. The LLM retained **75**, explaining that neither a spike nor sustained decline justified an override. Its lack of intervention matters: I would say that the classical forecast is the reference point here, since the LLM provided nothing different of merit.

For the next Gloves replenishment decision, I would use 518 as a provisional risk-planning scenario rather than rely solely on 354, because the baseline smooths a rapidly rising series and then applies historical seasonality. However, neither value establishes forecast accuracy: there is no held-out future observation, only twelve historical months. I would review spike persistence and seasonal explanations before committing stock. For Bottle, I would trust the unchanged classical baseline more because the recent series is stable and the LLM adds no independent evidence. In other words, we're probably north of 500 for gloves, but likely in-line for bottles, and hopefully that bears out. Certainly the model thinks it will.

These judgments do not mean the submission automatically feeds 518 into EOQ. Its original branches are independent: inventory uses historical annual demand. The comparison illustrates a limitation of the classical assumptions, not a proven causal effect or a validated improvement in forecast error. Scenario checks retain original model values if corrections are needed; execution 41 required none.

It seems to me -- with all my intimacy with n8n after a week -- that we should consider adjustment based on LLM-fed context when it seems to challenge the assumptions, with a justifiable reason, rather than simply assuming the LLM estimate is more accurate and adopting it flat out.

## 2. EOQ assumption analysis

EOQ implements `round(sqrt(2*D*S/H))`, with ordering cost USD 50 and historical annual demand. Zero or invalid demand/holding-cost inputs return zero. Its arithmetic can be correct while its assumptions are unsuitable.

I implemented four flags:

- **viral_spike:** latest three-month mean exceeds 2.5 times the preceding nine-month mean. SKU-007 triggers it. In execution 43 the model proposed **539 units**, while its explanation contradicted that quantity. The policy validator produced **736**, using the greater of a 25% EOQ uplift and uncovered lead-time-plus-30-day demand. I tentatively agree with emergency review, but feel prudence would regard that quantity as requiring human confirmation, and probably should trigger an agentic guardrail of some type before its pressed any further through the real world.
- **declining:** latest three-month mean is below half the first three-month mean. SKU-013 triggers it. The model recommended **markdown, no reorder**, which the validator retained. With 540 units on hand and falling demand, I agree; decline alone does not justify claiming discontinuation or liquidating stock. Neither does it justify re-ordering or any increase it inventory. At this point, its a hold item.
- **low_velocity:** historical annual demand below **60 units**. No original SKU triggers it. Controlled tests covered low-volume input; I cannot present an original-data example. The intended response is a small uncovered monthly replenishment or hold, rather than mechanically ordering EOQ. If I need to go back and implement this, I would probably do it with a brand-new SKU added to the dataset to observe what happened.
- **long_lead_time:** lead time above **28 days**, with population coefficient of variation above **0.5**. Thermal Jacket, SKU-006, triggers it. The raw model said hold despite describing reorder exposure; validation corrected this to **147 units**. I agree with reviewing the gap, while recognizing seasonal overstock risk. Some of this answer probably depends on speed of delivery and how close we are to the time it needs to be on shelves, neither of which are explicitly allowed for in the test run. I suspect there are probably a few more interpretive elements that would be valuable in getting a tighter response from this items.

Multiple flags can coexist, and do potentially impact re-ordering decisions (the Thermal Jacket, for instance, exceeded the EOQ by nearly 10%, which felt like a sufficient amount to be meaningful; Sonnet's structured fields said to hold at the curent level, but the code interpreted this (in my opinion, correctly) as a buy situation, so we resulted it appropriately. I would argue that historically this combination of multiple qualifying flags would be where model-based processing would struggle the most. I was surprised by the accuracy with which the build projected things even when they fell into traditional "gray areas"; I should like to take credit but I suspect most of that was in the provided base model more than in my additions. Perishability was omitted from the build because the demo products are non-perishable; a real deployment would need shelf-life constraints and probably some kind of down-scaling cost consideration (so that Thermal Jackets had a price reduction in February rather than carrying the inventory for another ten months). The thresholds are explicit screening choices, not calibrated probabilities.

## 3. Supplier rubric defense

The assumed business is Coastal Goods, a direct-to-consumer e-commerce retailer. My weights total **100%: reliability 35%, quality 25%, lead time 25%, and cost 15%**. Missed deliveries and defective goods directly threaten customer service, so reliability and quality together outweigh cash-flow flexibility. A hospital, for instance, would require stronger safety and continuity constraints than this retail rubric.

The cost measure is explicitly a **payment-terms proxy**, not purchase price. Fixed scoring anchors make comparisons independent of roster composition: 60-day payment terms, 42-day lead-time scale, 70%-100% on-time scale, and 0%-5% defect scale.

In execution 42, the **validated** leader was **GreenLeaf Goods, 80.83/100**, and the lowest was **Pacific Rim Trading, 53.66/100**. This matches my expectation: GreenLeaf's seven-day lead time, 97% on-time rate and 0.8% defects outweigh Pacific Rim's more favorable payment terms.

This was not flawless LLM arithmetic, by any means (only some of those executions were because of my code mistakes, more than a few were a function of trying to really understand the outputs, especially when they skewed). In 42, five supplier rows needed component, total or tier corrections. Final Output retained reported scores and flagged affected recommendations for review. The rubric interpretation is useful; however, I should think a fair bit of fine-tuning would be in order beyond this (pretty simple compared to an actual market analysis) comparison and I suspect consulting with an actual supply chain manager would probably point out more than a few things that I got wrong at the business-rule layer.

## 4. Run metrics

These were genuine end-to-end runs: only the goal changed, the planner selected `next_subgoal`, and the original Switch executed one branch. Each used two LLM calls: planner plus a batched leaf request. Tokens include both calls, not merely the leaf output.

| Branch | Execution | Total tokens | Estimated USD | Seconds |
|---|---:|---:|---:|---:|
| Forecast | 41 | 5,138 | 0.029106 | 18.479 |
| Inventory | 43 | 7,047 | 0.038385 | 27.234 |
| Supplier | 42 | 3,472 | 0.020028 | 17.118 |
| Logistics | 40 | 3,362 | 0.016998 | 14.084 |

Estimates use [recorded pricing and usage](tests/run-metrics.json): Sonnet 4.6 input USD 3/million and output USD 15/million. No cache tokens were reported. These are estimates, not invoices, and exclude development failures. Batching kept every measured run below USD 0.10. The main surprise from these runs was that valid structured JSON still contained incorrect numbers and contradictory explanations. Given the number of tests I ran to get to this point, I would estimate the total cost of this assignment in Sonnet tokens to be less than $5.

I think its pretty critical (and I will talk about it a bit more in the primer response) to acknowledge that in this run (42), the LLM reported Pacific Rim at 60.25 and labeled it “Approved.” That label even conflicted with our 70-point Approved threshold. Code recalculated the components and corrected its score and tier, preserving the original output (i.e., making it Deprioritized instead of approved).

So it seems to me that the ranking makes sense for this retail business, but the LLM’s arithmetic *cannot be accepted unchecked.* Deprioritizing Pacific Rim means reviewing reliance and improvement options; it doesn’t mean the workflow automatically replaced the supplier. This is really important, and comes back to that supply chain manager experience I talked about; even though the vendor might not be as reliable as we want, they might have more thermal jackets on hand than the other (for instance) and so we keep them as the vendor to single source that item (or even just to supplement GreenLeaf). That level of judgment is NOT embodied in the exercise at this point, but feels like the place where the applications gets far more useful.

## 5. The four primer questions

1. **Classical error versus LLM error:** For Gloves, the classical forecast was 354 units. It smoothed the recent spike and applied historical seasonality. The LLM recognized the supplied upward trend and proposed 518 as a continuation scenario.
That challenges the baseline’s assumptions; it doesn’t prove 518 predicts future sales better.
In the other direction, the LLM produced supplier arithmetic errors and inventory fields that contradicted its explanations. Our classical validators caught those inconsistencies and preserved the original outputs alongside the corrections.

2. **Unknown planner route:** The Switch has no matching branch. Without protection, an item could reach an unmatched output without producing the intended result. The submission defends against that in two places:
- The response schema permits only forecast, inventory, supplier, or logistics.
- Parse Plan checks the route and its consistency with the plan before dispatch.
To validate these assumptions, I tested an unsupported route and confirmed it throws an error before reaching the Switch. That makes the failure visible without changing the original topology.

3. **Declining Earbuds:** EOQ uses historical annual demand and returns a batch size of 397 units. But Earbuds sales are declining, and there are already 540 units on hand. The formula isn’t mathematically broken. Its constant-demand assumption is unsuitable here—and its batch size should never automatically mean “buy this now.”

The implemented declining flag detects that the latest three-month average is less than half the first three-month average. The exception handler recommended markdown, with zero new-order quantity, and validation retained that recommendation.

4. **Why divide the work:** From my very limited knowledge of the real-world aspects of this problem, I think there are really two parts to supplier evaluation:

- Judgment: choosing priorities, explaining trade-offs and discussing improvement actions.
- Arithmetic: applying fixed weights and calculating totals.

The LLM helps with the first. Once the rubric is fixed, code is more reliable for the second—as our supplier corrections demonstrated. I would add that adding some kind of scoring call to the routine -- JEV or Decisions API or something similar that would attach confidence to weightings -- would probably be really valuable, but again, the rubric needs to be fixed for that to hold up (though I suppose during test runs it could highlight flaws).

EOQ already has a precise formula, so asking an LLM to calculate it adds uncertainty without a clear benefit. Conversely, a purely classical supplier system could calculate our fixed rubric perfectly, but would need explicit rules for any additional qualitative considerations. As with so many things, especially now, the best answer seems like a combination of deterministic and inferred.

In the end, the supplier evaluation benefits from language-based reasoning, especially if the rubric is tied down; however, fixed score arithmetic is probably better served by NOT using an LLM, and sticking with a known deterministic path.

## Demo video

The recorded walkthrough is included in [demo.mp4](demo.mp4).
