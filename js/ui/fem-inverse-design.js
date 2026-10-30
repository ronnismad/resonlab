import { FEM_DESIGN_BOUNDS } from '../physics/fem-inverse-design.js?v=20261031';
import { helmholtzFemGeometry } from '../physics/helmholtz-fem.js?v=20261027';
import { MULTI_DIMENSIONS, DEFAULT_SIZE_LIMITS } from '../physics/fem-multi-design.js?v=20261101';

const el=(tag,text,cls='')=>Object.assign(document.createElement(tag),{className:cls,...(text==null?{}:{textContent:text})});
const fmt=(v,n=3)=>Number.isFinite(v)?v.toFixed(n):'Unresolved';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABELS={volume:'Cavity volume',neckLength:'Neck length',neckRadius:'Neck radius',scale:'Uniform size scale',cavityAspectRatio:'Cavity height / diameter',multiple:'Joint geometry'};
const SCALES={volume:1000,neckLength:1000,neckRadius:1000,scale:1,cavityAspectRatio:1};
const UNITS={volume:'L',neckLength:'mm',neckRadius:'mm',scale:'× current size',cavityAspectRatio:'ratio'};

export function mountFemInverseDesign({host,getState,setSettings,getGeometry,getStudy,getLosses,getLevel,runSearch,cancelSearch,onBusy,onApply,onExport}){
  const box=el('section',null,'fem-inverse-design');box.setAttribute('aria-label','Automatic FEM inverse design');
  const disclosure=el('details',null,'inverse-disclosure');disclosure.open=!matchMedia('(max-width: 820px)').matches;
  const summary=el('summary','Find dimensions for frequency & Q');
  const intro=el('p',null,'note');box.append(intro);
  const inputs=el('fieldset',null,'inverse-inputs'),state=getState();
  const mode=el('select');mode.setAttribute('aria-label','Inverse design targets');
  for(const [value,title] of [['frequency-q','Frequency and Q together'],['frequency','Frequency only · one dimension']]){const option=el('option',title);option.value=value;mode.append(option);}
  mode.value=state.inverseMode||'frequency-q';const modeLabel=el('label','Design targets');modeLabel.append(mode);inputs.append(modeLabel);
  const parameter=el('select'),metric=el('select');parameter.setAttribute('aria-label','Dimension to adjust');metric.setAttribute('aria-label','Inverse design frequency definition');
  for(const [key,label] of [['auto','Automatic · choose a suitable dimension'],...Object.entries(LABELS).filter(([key])=>!['multiple','cavityAspectRatio'].includes(key))]){const option=el('option',label);option.value=key;parameter.append(option);}
  parameter.value=state.inverseParameter||'auto';
  for(const [value,label] of [['application','Current application peak · recommended'],['lossless','Lossless fundamental mode']]){const option=el('option',label);option.value=value;metric.append(option);}
  metric.value=state.inverseMetric||'application';
  for(const [title,input] of [['Dimension to adjust',parameter],['Frequency to match',metric]]){const label=el('label',title);label.append(input);inputs.append(label);}
  const qLabel=el('label','Target isolated bandwidth Q'),targetQ=el('input');targetQ.type='number';targetQ.min='.01';targetQ.step='any';targetQ.value=state.inverseTargetQ??60;targetQ.setAttribute('aria-label','Target isolated bandwidth Q');qLabel.append(targetQ);inputs.append(qLabel);
  const qNote=el('p','Q means the isolated cavity-pressure half-power bandwidth Q, with the current losses held fixed. In panel or duct tasks, the frequency target can be a mounted peak while Q remains this separate isolated reference.','note');inputs.append(qNote);
  const dimensionGroup=el('fieldset',null,'inverse-dimensions');dimensionGroup.append(el('legend','Dimensions to adjust together'));
  const dimensionInputs={};
  for(const key of MULTI_DIMENSIONS){const label=el('label'),checkbox=el('input');checkbox.type='checkbox';checkbox.checked=(state.inverseDimensions||MULTI_DIMENSIONS).includes(key);checkbox.setAttribute('aria-label','Adjust '+LABELS[key].toLowerCase());dimensionInputs[key]=checkbox;label.append(checkbox,document.createTextNode(' '+LABELS[key]));dimensionGroup.append(label);}
  inputs.append(dimensionGroup);
  const sizeGroup=el('fieldset',null,'inverse-size-limits');sizeGroup.append(el('legend','Overall resonator size limits'));
  const sizeInputs={};
  for(const [key,title] of [['maxDiameter','Maximum overall diameter (mm)'],['maxHeight','Maximum overall height (mm)'],['allowance','Wall / packaging allowance per side (mm)']]){
    const label=el('label',title),input=el('input');input.type='number';input.min=key==='allowance'?'0':'.01';input.step='any';input.value=(state.inverseSizeLimits?.[key]??DEFAULT_SIZE_LIMITS[key])*1000;input.setAttribute('aria-label',title);sizeInputs[key]=input;label.append(input);sizeGroup.append(label);
  }
  sizeGroup.append(el('p','Overall diameter includes twice the allowance. Overall height includes cavity height, neck length and twice the allowance. The allowance reserves space; it does not simulate structural walls.','note'));inputs.append(sizeGroup);
  const advanced=el('details',null,'engineering-details');advanced.append(el('summary','Dimension bounds & accuracy'));
  const tolerance=el('input');tolerance.type='number';tolerance.min='.01';tolerance.max='2';tolerance.step='.01';tolerance.value=state.inverseTolerancePct??.1;tolerance.setAttribute('aria-label','Inverse frequency tolerance (%)');
  const toleranceLabel=el('label','Frequency tolerance (%)');toleranceLabel.append(tolerance);advanced.append(toleranceLabel);
  const qTolerance=el('input');qTolerance.type='number';qTolerance.min='.1';qTolerance.max='20';qTolerance.step='.1';qTolerance.value=state.inverseQTolerancePct??2;qTolerance.setAttribute('aria-label','Inverse Q tolerance (%)');
  const qToleranceLabel=el('label','Q tolerance (%)');qToleranceLabel.append(qTolerance);advanced.append(qToleranceLabel);
  const effort=el('select');effort.setAttribute('aria-label','Joint search effort');
  const budgets=[100,180];if(!budgets.includes(state.inverseMaxEvaluations)&&state.inverseMaxEvaluations>=16&&state.inverseMaxEvaluations<=240)budgets.push(state.inverseMaxEvaluations);
  for(const budget of budgets){const option=el('option',`${budget} driven FEM trials maximum`);option.value=String(budget);effort.append(option);}effort.value=String(state.inverseMaxEvaluations??100);
  const effortLabel=el('label','Search effort');effortLabel.append(effort);advanced.append(effortLabel);
  const boundInputs={},boundRows={};
  for(const key of Object.keys(FEM_DESIGN_BOUNDS)){
    const bounds=state.inverseBounds?.[key]||FEM_DESIGN_BOUNDS[key],row=el('div',null,'inverse-bound-row');
    row.append(el('span',`${LABELS[key]} (${UNITS[key]})`));boundInputs[key]=[];
    for(let i=0;i<2;i++){const input=el('input');input.type='number';input.step='any';input.min=key==='neckLength'?'0':'0.000001';input.value=bounds[i]*SCALES[key];input.setAttribute('aria-label',`${i?'Maximum':'Minimum'} ${LABELS[key].toLowerCase()} (${UNITS[key]})`);boundInputs[key].push(input);row.append(input);}
    advanced.append(row);boundRows[key]=row;
  }
  const boundsNote=el('p',null,'note');advanced.append(boundsNote);
  inputs.append(advanced);box.append(inputs);
  const actions=el('div',null,'research-actions');
  const find=el('button','Find dimensions with FEM','btn btn-primary'),cancel=el('button','Cancel design search','btn');find.type=cancel.type='button';cancel.hidden=true;
  actions.append(find,cancel);box.append(actions);
  const status=el('p','Uses the selected mesh and current medium/loss settings. Your geometry stays unchanged until Apply.','note');status.setAttribute('role','status');
  const output=el('div',null,'inverse-proposal');box.append(status,output);
  disclosure.append(summary,...box.childNodes);box.append(disclosure);host.append(box);
  let busy=false,proposal=null;
  function updateMode(){
    const joint=mode.value==='frequency-q';parameter.parentElement.hidden=joint;
    summary.textContent=joint?'Find dimensions for frequency & Q':'Find dimensions for a target frequency';
    for(const element of [qLabel,qNote,dimensionGroup,sizeGroup,qToleranceLabel,effortLabel])element.hidden=!joint;
    boundRows.scale.hidden=joint;boundRows.cavityAspectRatio.hidden=!joint;
    intro.textContent=joint?'Enter a target frequency above and a target Q below. FEM adjusts the unlocked dimensions together inside the overall size limits, then verifies both targets before you can Apply. Coarse exploration is followed by refinement on your selected mesh.'
      :'Enter the target frequency above, then let FEM propose a bounded geometry change. Automatic mode tries volume, neck length, then neck radius. Other dimensions remain fixed.';
    boundsNote.textContent=joint?'All four dimension bounds and the overall envelope limits apply together. Unchecked dimensions remain fixed and must already satisfy their bounds. At least two dimensions must be adjustable. Losses and mounting dimensions stay fixed; this local search cannot guarantee a global optimum.'
      :'Each range applies when that dimension is varied; other dimensions retain their current values. Panel fit, neck/cavity fit and duct clearance also apply. Uniform scaling uses the scale range. Joint Q and overall-envelope limits apply only in Frequency and Q together mode.';
  }
  mode.addEventListener('change',updateMode);updateMode();
  const options=()=>({inverseMode:mode.value,inverseTargetQ:Number(targetQ.value),inverseQTolerancePct:Number(qTolerance.value),inverseMaxEvaluations:Number(effort.value),
    inverseDimensions:MULTI_DIMENSIONS.filter(key=>dimensionInputs[key].checked),inverseSizeLimits:Object.fromEntries(Object.entries(sizeInputs).map(([key,input])=>[key,Number(input.value)/1000])),
    inverseParameter:parameter.value,inverseMetric:metric.value,inverseTolerancePct:Number(tolerance.value),
    inverseBounds:Object.fromEntries(Object.entries(boundInputs).map(([key,pair])=>[key,pair.map(input=>Number(input.value)/SCALES[key])]))});
  function invalidate(){proposal=null;output.replaceChildren();if(!busy)status.textContent='Settings changed. Find dimensions again to create a current proposal.';}
  inputs.addEventListener('change',()=>{setSettings(options());invalidate();});
  inputs.addEventListener('input',()=>{setSettings(options());invalidate();});
  function setBusy(value){busy=value;inputs.disabled=value;find.disabled=value;output.querySelectorAll('button').forEach(button=>{button.disabled=value;});}
  const record=state.inverseDesignRecord;
  if(record)output.append(el('p',`Previously applied design: ${record.metric==='lossless'?'lossless mode':record.application+' peak'} ${fmt(record.frequency)} Hz for target ${fmt(record.targetFrequency)} Hz${record.mode==='frequency-q'?`; Q ${fmt(record.qualityFactor,2)} for target ${fmt(record.targetQ,2)}`:''} on ${record.level} mesh. This saved record describes that earlier verification; current solved results remain authoritative.`,'note'));
  function show(d){
    output.replaceChildren();
    if(d.status!=='converged'){
      output.append(el('p',d.note,'model-warning'));
      for(const attempt of d.attempts)output.append(el('p',`${LABELS[attempt.parameter]}: ${attempt.message}${attempt.rangeHz?` Lossless FEM range ${fmt(attempt.rangeHz[0],1)}–${fmt(attempt.rangeHz[1],1)} Hz.`:''}`,'note'));
      if(d.best)output.append(el('p',`${d.mode==='frequency-q'?'Closest evaluated trial ('+d.best.level+' mesh)':'Closest verified candidate'}: ${fmt(d.best.frequency)} Hz (${fmt(100*d.best.relativeError)}% error)${d.mode==='frequency-q'?`; Q ${fmt(d.best.qualityFactor,2)} (${fmt(100*d.best.qRelativeError)}% error)`:''}. It did not pass all target checks and cannot be applied from this proposal.`,'note'));
      return;
    }
    const old=helmholtzFemGeometry(d.originalGeometry),g=helmholtzFemGeometry(d.geometry),label=d.metric==='lossless'?'Lossless fundamental':d.application==='tune'?'Isolated damped pressure peak':d.application==='absorber'?'Mounted absorption peak':'Mounted transmission-loss peak';
    const joint=d.mode==='frequency-q';
    output.innerHTML=`<h4>Verified proposal · ${escape(label)}</h4><div class="result-metrics"><div><span>Target</span><strong>${fmt(d.targetFrequency)} Hz</strong></div><div><span>Verified FEM frequency</span><strong>${fmt(d.frequency)} Hz</strong></div><div><span>Frequency error</span><strong>${fmt(100*d.relativeError)}%</strong></div></div>
      ${joint?`<div class="result-metrics"><div><span>Target isolated Q</span><strong>${fmt(d.targetQ,2)}</strong></div><div><span>Verified isolated Q</span><strong>${fmt(d.qualityFactor,2)}</strong></div><div><span>Q error</span><strong>${fmt(100*d.qRelativeError)}%</strong></div></div><p class="note">${escape(d.qDefinition)}</p>`:''}
      <p class="note">Adjusted ${joint?'together: '+d.dimensions.map(key=>escape(LABELS[key])).join(', '):escape(LABELS[d.parameter])} · ${escape(d.level)} mesh · ${d.eigenSolves} ${joint?'driven FEM trials':'eigenmode solves'} · ${d.verifications} final verification runs.</p>
      <table class="result-table"><thead><tr><th>Dimension</th><th>Current</th><th>Proposed</th></tr></thead><tbody>
      <tr><th>Cavity volume</th><td>${fmt(old.volume*1000)} L</td><td>${fmt(g.volume*1000)} L</td></tr>
      <tr><th>Neck radius</th><td>${fmt(old.neckRadius*1000)} mm</td><td>${fmt(g.neckRadius*1000)} mm</td></tr>
      <tr><th>Neck length</th><td>${fmt(old.neckLength*1000)} mm</td><td>${fmt(g.neckLength*1000)} mm</td></tr>
      <tr><th>Cavity height / diameter</th><td>${fmt(old.cavityAspectRatio)}</td><td>${fmt(g.cavityAspectRatio)}</td></tr>
      <tr><th>Cavity radius / height</th><td>${fmt(old.radius*1000)} / ${fmt(old.height*1000)} mm</td><td>${fmt(g.radius*1000)} / ${fmt(g.height*1000)} mm</td></tr></tbody></table>
      ${joint?`<h4>Overall envelope · within limits</h4><table class="result-table"><tbody><tr><th>Diameter / maximum</th><td>${fmt(d.envelope.diameter*1000)} / ${fmt(d.sizeLimits.maxDiameter*1000)} mm</td></tr><tr><th>Total height / maximum</th><td>${fmt(d.envelope.height*1000)} / ${fmt(d.sizeLimits.maxHeight*1000)} mm</td></tr><tr><th>Allowance per side</th><td>${fmt(d.sizeLimits.allowance*1000)} mm</td></tr></tbody></table>`:''}
      <p class="note">Isolated bandwidth Q: ${fmt(d.result.response?.Q,2)}.${d.application==='absorber'?` Mounted peak absorption: ${fmt(100*d.result.performance?.peak?.alpha,2)}%.`:d.application==='duct'?` Peak transmission loss: ${fmt(d.result.performance?.peak?.TLdB,2)} dB.`:''} ${escape(d.note)}</p>`;
    for(const warning of [...(d.result.response?.warnings||[]),...(d.result.performance?.warnings||[])])output.append(el('p',warning,'model-warning'));
    if(d.result.responseError)output.append(el('p',d.result.responseError,'model-warning'));
    const apply=el('button','Apply proposed dimensions','btn btn-primary'),exportButton=el('button','Export proposed project','btn');apply.type=exportButton.type='button';
    apply.disabled=exportButton.disabled=busy;
    apply.addEventListener('click',()=>{if(proposal===d&&!busy){proposal=null;apply.disabled=exportButton.disabled=true;onApply(d);}});exportButton.addEventListener('click',()=>{if(proposal===d&&!busy)onExport(d);});
    const buttons=el('div',null,'research-actions');buttons.append(apply,exportButton);output.append(buttons);
    const history=el('details',null,'engineering-details');history.append(el('summary','Inspect FEM search history'));
    const rows=el('div',null,'fem-convergence-table');
    rows.innerHTML=joint?`<table class="result-table"><thead><tr><th>Stage / mesh</th><th>Frequency</th><th>Q</th><th>Frequency error</th><th>Q error</th><th>Volume (L)</th><th>Neck radius (mm)</th><th>Neck length (mm)</th><th>Aspect</th><th>Overall D / H (mm)</th></tr></thead><tbody>${d.trace.map(row=>`<tr><td>${escape(row.stage)} / ${escape(row.level)}</td><td>${fmt(row.frequency)}</td><td>${fmt(row.qualityFactor,2)}</td><td>${fmt(100*row.error)}%</td><td>${fmt(100*row.qError)}%</td><td>${fmt(row.geometry.volume*1000)}</td><td>${fmt(row.geometry.neckRadius*1000)}</td><td>${fmt(row.geometry.neckLength*1000)}</td><td>${fmt(row.geometry.cavityAspectRatio)}</td><td>${fmt(row.envelope.diameter*1000)} / ${fmt(row.envelope.height*1000)}</td></tr>`).join('')}</tbody></table>`
      :`<table class="result-table"><thead><tr><th>Stage</th><th>Parameter</th><th>Value</th><th>FEM frequency</th><th>Error</th></tr></thead><tbody>${d.trace.map(row=>`<tr><td>${escape(row.stage)}</td><td>${escape(LABELS[row.parameter])}</td><td>${fmt(row.value*SCALES[row.parameter],4)} ${escape(UNITS[row.parameter])}</td><td>${fmt(row.frequency)} Hz</td><td>${fmt(100*row.error)}%</td></tr>`).join('')}</tbody></table>`;
    history.append(rows);output.append(history);
  }
  find.addEventListener('click',async()=>{
    proposal=null;output.replaceChildren();
    const study=getStudy();setSettings({...options(),...study});
    const request={geometry:getGeometry(),c:getLosses().c,losses:getLosses().losses,level:getLevel(),...study,
      parameter:parameter.value,metric:metric.value,bounds:options().inverseBounds,tolerance:Number(tolerance.value)/100,
      mode:mode.value,targetQ:Number(targetQ.value),qTolerance:Number(qTolerance.value)/100,dimensions:options().inverseDimensions,sizeLimits:options().inverseSizeLimits,maxEvaluations:Number(effort.value)};
    setBusy(true);onBusy(true);cancel.hidden=false;status.textContent='Searching with FEM. This can take longer on a fine mesh; current geometry is unchanged.';
    try{
      const d=await runSearch(request,p=>{status.textContent=p.parameter==='multiple'?`${p.phase} · trial ${p.evaluations}/${p.maxEvaluations} · ${fmt(p.frequency,2)} Hz · Q ${fmt(p.qualityFactor,2)} · errors ${fmt(100*p.error,2)}% / ${fmt(100*p.qError,2)}%`:`${LABELS[p.parameter]} · ${p.phase} · ${fmt(p.frequency,2)} Hz · ${fmt(100*p.error,2)}% error · ${p.eigenSolves} eigenmode solves`;});
      if(!box.isConnected)return;
      proposal=d;show(d);status.textContent=d.status==='converged'?(d.mode==='frequency-q'?'Frequency, isolated Q and size limits verified. Review before Apply or export.':'Target matched and verified. Review before Apply or export.'):'No verified match within the permitted search effort and limits. Your geometry is unchanged.';
    }catch(error){if(box.isConnected)status.textContent=error.message.includes('cancelled')?'Design search cancelled. Your geometry is unchanged.':`Design search failed: ${error.message}`;}
    finally{if(box.isConnected){setBusy(false);onBusy(false);cancel.hidden=true;}}
  });
  cancel.addEventListener('click',cancelSearch);
  return {setBusy,invalidate};
}
