const text=$json.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
const plan=JSON.parse(text);
const allowed=['forecast','inventory','supplier','logistics'];
if (!allowed.includes(plan.next_subgoal) || !Array.isArray(plan.subgoals) || !plan.subgoals.length || plan.subgoals[0].type!==plan.next_subgoal || plan.subgoals.some(s=>!allowed.includes(s.type))) throw new Error('Planner returned an invalid or inconsistent route');
const ctx=$('Build Context Summary').first().json;
return [{json:{...plan,_goal:ctx.goal,_context:ctx.context_summary}}];
