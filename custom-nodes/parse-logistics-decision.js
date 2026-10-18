const text=$input.first().json.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
const decisions=JSON.parse(text).decisions;
const requests=$('Build Shipping Requests').all().map(i=>i.json);
if (!Array.isArray(decisions) || decisions.length!==requests.length || new Set(decisions.map(d=>d.request_id)).size!==requests.length) throw new Error('Missing or duplicate logistics decisions');
return requests.map(request=>{
 const d=decisions.find(x=>x.request_id===request.request_id);
 if (!d || typeof d.use_classical_fallback!=='boolean') throw new Error('Invalid logistics routing decision');
 if (!d.use_classical_fallback && d.chosen_option_id!==null) {
  const o=$('Read Shipping JSON').all().map(i=>i.json).find(o=>o.option_id===d.chosen_option_id);
  if (!o || o.origin_region!==request.origin_region || o.destination_region!==request.dest_region || Number(o.transit_days)>request.deadline_days || Number(o.max_weight_kg)<request.weight_kg || (request.perishable && o.supports_perishable!=='true' && o.supports_perishable!==true)) throw new Error('LLM selected an infeasible carrier');
 }
 return {json:{...request,llm_decision:d,use_classical_fallback:d.use_classical_fallback},pairedItem:{item:0}};
});
