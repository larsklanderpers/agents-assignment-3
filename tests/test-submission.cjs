const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.SUBMISSION_REPO_ROOT || path.resolve(__dirname,'..');
const wf=JSON.parse(fs.readFileSync(path.join(root,'workflows/supply-chain-manager-starter.json')));
const topology=JSON.parse(fs.readFileSync(path.join(root,'tests/original-topology.json')));
assert.deepEqual(wf.nodes.map(n=>[n.id,n.name,n.type]),topology.nodes);assert.deepEqual(wf.connections,topology.connections);
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'tests/data-fixtures.json')));
const $=name=>({all:()=>fixtures[name].map(json=>({json}))});
const run=name=>new Function('$',wf.nodes.find(n=>n.name===name).parameters.jsCode)($);
const forecasts=run('Demand Forecast Engine'),inventory=run('Inventory EOQ Planner');assert.equal(forecasts.length,15);assert.equal(inventory.length,15);assert.equal(inventory.find(x=>x.json.sku==='SKU-007').json.eoq_units,431);assert.ok(inventory.find(x=>x.json.sku==='SKU-013').json.assumption_flags.includes('declining'));
for(const n of wf.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest')) {
 const expression=n.parameters.jsonBody.slice(3,-2).trim();
 const jsonInput=n.name==='Master Planner Agent'?{goal:'Standalone supplier ranking',context_summary:{}}:{};
 const outputs={...fixtures,'Demand Forecast Engine':forecasts.map(x=>x.json),'Inventory EOQ Planner':inventory.map(x=>x.json),'Build Shipping Requests':[{request_id:'TEST',type:'request'}]};
 const request=new Function('$','$json','return ('+expression+');')(name=>({all:()=>outputs[name].map(json=>({json}))}),jsonInput);
 assert.equal(request.model,'claude-sonnet-4-6');assert.ok(request.system.split(/\s+/).length<500);assert.equal(request.output_config.format.type,'json_schema');assert.equal(typeof request.messages[0].content,'string');
}
const parse=wf.nodes.find(n=>n.name==='Parse Plan').parameters.jsCode;
const invalid={next_subgoal:'audit_warehouse',subgoals:[{type:'audit_warehouse'}]};
assert.throws(()=>new Function('$','$json',parse)(()=>({first:()=>({json:{}})}),{content:[{type:'text',text:JSON.stringify(invalid)}]}),/invalid/);
console.log('Original 27-node topology, exact connections, classical data execution, anomaly flags, all request templates, Sonnet 4.6, prompt limits and invalid-route rejection passed.');
