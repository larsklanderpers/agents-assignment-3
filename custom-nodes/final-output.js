const plan=$('Parse Plan').first().json;
const stage=plan.next_subgoal;
const rows=name=>$(name).all().map(i=>i.json);
const response=name=>JSON.parse(rows(name)[0].content.filter(c=>c.type==='text').map(c=>c.text).join('\n'));
let details={},findings=[],actions=[];
if(stage==='forecast'){
 const base=rows('Demand Forecast Engine'), revised=response('Forecast Context Adjuster').forecasts;
 if(revised.length!==base.length || new Set(revised.map(r=>r.sku)).size!==base.length)throw new Error('Missing or duplicate forecast rows');
 const forecasts=base.map(b=>{const a=revised.find(r=>r.sku===b.sku);if(!a || !Number.isInteger(a.revised_forecast) || a.revised_forecast<0)throw new Error('Invalid forecast');const history=rows('Read Sales JSON').filter(r=>r.sku===b.sku).sort((x,y)=>x.month.localeCompare(y.month));
 const mean=x=>x.length?x.reduce((s,r)=>s+Number(r.units_sold),0)/x.length:0;
 const recent=mean(history.slice(-3)),prior=mean(history.slice(0,-3)),first=mean(history.slice(0,3)),last=Number(history[history.length-1].units_sold);
 let expected=b.forecast_units;if(recent>2.5*prior)expected=last;else if(recent<.5*first)expected=Math.min(b.forecast_units,last);
 const delta=b.forecast_units?Math.round((expected-b.forecast_units)/b.forecast_units*10000)/100:0;
 const corrected=a.revised_forecast!==expected||Math.abs(a.delta_pct-delta)>.011;
 return {...b,...a,baseline_units:b.forecast_units,revised_forecast:expected,delta_pct:delta,forecast_validation:{corrected:corrected,llm_reported_units:a.revised_forecast,llm_reported_delta_pct:a.delta_pct,original_reasoning:a.reasoning},reasoning:corrected?'Scenario-policy validator corrected the numeric output; review original model reasoning in forecast_validation. This is a historical continuation scenario, not proven future demand.':a.reasoning};});
 details={forecasts};findings=[`Forecasted ${forecasts.length} SKUs.`,`${forecasts.filter(r=>r.revised_forecast!==r.baseline_units).length} forecasts revised using supplied historical observations.`];actions=forecasts.filter(r=>r.revised_forecast!==r.baseline_units).map(r=>({sku:r.sku,action:'review_adjustment',reason:r.reasoning}));
}else if(stage==='inventory'){
 const baseline=rows('Inventory EOQ Planner'), recommendations=response('Inventory Exception Handler').recommendations;
 if(recommendations.length!==baseline.length || new Set(recommendations.map(r=>r.sku)).size!==baseline.length)throw new Error('Missing or duplicate inventory recommendations');
 for(const r of recommendations){if(!baseline.some(b=>b.sku===r.sku)||!Number.isInteger(r.recommended_qty)||r.recommended_qty<0||(r.recommended_action!=='reorder'&&r.recommended_qty!==0))throw new Error('Invalid inventory action');}
 for(const row of baseline){
 const r=recommendations.find(r=>r.sku===row.sku);const inv=rows('Read Inventory JSON').find(i=>i.sku===row.sku);
 const history=rows('Read Sales JSON').filter(s=>s.sku===row.sku).sort((a,b)=>a.month.localeCompare(b.month)).slice(-3);
 const monthly=history.length?history.reduce((s,x)=>s+Number(x.units_sold),0)/history.length:0;const daily=monthly/30;const lead=Number(inv.lead_time_days);
 const gap=Math.max(0,Math.ceil(daily*(lead+30)-row.on_hand));const exposed=row.on_hand<daily*lead||row.on_hand<=row.reorder_point;
 let action='hold',qty=0;
 if(row.assumption_flags.includes('declining'))action=row.on_hand>monthly?'markdown':'hold';
 else if(row.assumption_flags.includes('viral_spike')&&exposed){action='reorder';qty=Math.max(Math.ceil(1.25*row.eoq_units),gap);}
 else if(row.assumption_flags.includes('low_velocity')){qty=Math.max(0,Math.ceil(monthly-row.on_hand));action=qty?'reorder':'hold';}
 else if(row.assumption_flags.includes('long_lead_time')&&exposed){action='reorder';qty=Math.max(row.eoq_units,gap);}
 const corrected=action!==r.recommended_action||qty!==r.recommended_qty;
 r.policy_validation={corrected,llm_reported_action:r.recommended_action,llm_reported_qty:r.recommended_qty,original_reasoning:r.reasoning};
 r.recommended_action=action;r.recommended_qty=qty;
 if(corrected)r.reasoning='Classical validator enforced the explicitly stated coverage policy; original model recommendation and reasoning are retained in policy_validation. Review seasonality and heuristic assumptions before acting.';
}
details={inventory:baseline,recommendations};findings=[`${baseline.length} EOQ calculations; ${baseline.filter(r=>r.needs_llm_review).length} historical exception flags.`,`${recommendations.filter(r=>r.recommended_action==='reorder').length} reorder and ${recommendations.filter(r=>r.recommended_action==='markdown').length} markdown recommendations.`];actions=recommendations.filter(r=>r.recommended_action!=='hold');
}else if(stage==='supplier'){
 const ranked=response('Supplier Performance Monitor').supplier_rankings;
 const roster=rows('Read Suppliers JSON');if(ranked.length!==roster.length||new Set(ranked.map(r=>r.supplier_id)).size!==roster.length)throw new Error('Missing or duplicate supplier scores');
 for(const r of ranked){
 const source=roster.find(s=>s.supplier_id===r.supplier_id);if(!source)throw new Error('Unknown supplier');
 const clamp=x=>Math.max(0,Math.min(100,x));const round=x=>Math.round((x+Number.EPSILON)*100)/100;
 const expected={cost:round(clamp(Number(source.payment_terms_days)/60*100)*.15),lead_time:round(clamp((42-Number(source.avg_lead_time_days))/42*100)*.25),reliability:round(clamp((Number(source.on_time_rate)-.7)/.3*100)*.35),quality:round(clamp((1-Number(source.defect_rate)/.05)*100)*.25)};
 const total=round(Object.values(expected).reduce((a,b)=>a+b,0));
 const tier=total>=85?'preferred':total>=70?'approved':total>=55?'watch':'deprioritize';
 const corrected=Object.keys(expected).filter(k=>Math.abs(expected[k]-r.score_breakdown[k])>.011);
 if(Math.abs(total-r.score_total)>.011)corrected.push('score_total');if(tier!==r.tier)corrected.push('tier');
 r.score_validation={corrected_fields:corrected,llm_reported_scores:{score_total:r.score_total,score_breakdown:r.score_breakdown,tier:r.tier},recommendation_requires_review:corrected.length>0};
 r.score_breakdown=expected;r.score_total=total;r.tier=tier;
}
 ranked.sort((a,b)=>b.score_total-a.score_total||a.supplier_id.localeCompare(b.supplier_id));details={supplier_rankings:ranked};findings=[`Ranked ${ranked.length} suppliers.`,`${ranked[0].supplier_id} leads at ${ranked[0].score_total}/100.`,`${ranked.filter(r=>r.score_validation.corrected_fields.length).length} model score rows corrected by classical validation; original scores retained.`];actions=ranked.filter(r=>['watch','deprioritize'].includes(r.tier));
}else if(stage==='logistics'){
 const parsed=rows('Parse Logistics Decision');const assigned=parsed.some(r=>r.use_classical_fallback)?rows('Classical Logistics Fallback'):[];
 const shipments=parsed.map(r=>r.use_classical_fallback?assigned.find(a=>a.request_id===r.request_id):{request_id:r.request_id,chosen_option_id:r.llm_decision.chosen_option_id,feasible:r.llm_decision.chosen_option_id!==null,reasoning:r.llm_decision.trade_off_summary});
 if(shipments.some(r=>!r))throw new Error('Missing classical shipment result');details={shipments};findings=[`${shipments.length} shipment decisions; ${shipments.filter(r=>!r.feasible).length} infeasible.`];actions=shipments.filter(r=>!r.feasible).map(r=>({request_id:r.request_id,action:'manual_review_no_feasible_carrier'}));
}else throw new Error('Unknown branch');
const order=plan.subgoals.map(s=>s.type);const index=order.indexOf(stage);const remaining=order.slice(index+1);
return [{json:{plan_id:plan.plan_id,goal:plan._goal,executed_subgoal:stage,key_findings:findings,recommended_actions:actions,next_recommended_subgoal:remaining[0]||null,remaining_subgoals:remaining,details,limitations:['One planner-selected branch executes per run. No automatic purchasing or bookings.','Historical observations inform scenarios, not proven future demand. EOQ uses historical annual demand.','Fixed rubric anchors and inventory thresholds are exercise policy choices.']}}];
