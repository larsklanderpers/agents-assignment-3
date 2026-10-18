#!/usr/bin/env python3
"""Synchronize readable source into the existing original-topology submission workflow.
Prompt and JSON-schema edits belong in the workflow export. This builder preserves them.
"""
import json,pathlib
root=pathlib.Path(__file__).parent
p=root/'workflows/supply-chain-manager-starter.json'
w=json.loads(p.read_text())
for name,file in [('Demand Forecast Engine','demand-forecast.js'),('Inventory EOQ Planner','eoq-optimizer.js'),('Classical Logistics Fallback','classical-logistics.js'),('Final Output','final-output.js'),('Parse Plan','parse-plan.js'),('Parse Logistics Decision','parse-logistics-decision.js')]:
 next(n for n in w['nodes'] if n['name']==name)['parameters']['jsCode']=(root/'custom-nodes'/file).read_text().rstrip()+'\n'
p.write_text(json.dumps(w,indent=2)+'\n')
print('Synchronized source; topology and prompts preserved.')
