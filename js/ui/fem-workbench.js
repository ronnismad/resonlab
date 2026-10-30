import { APPLICATIONS } from '../physics/acoustic-performance.js?v=20261031';
import { parseMeasuredResponse, compareMeasurement } from '../physics/measurement-comparison.js?v=20261031';
import { plotStudyCurves, disposePlot } from '../visualization/plots.js?v=20251023';
import { downloadBlob, downloadApplicationPerformanceCSV } from '../export/export.js?v=20251023';

const make=(tag,cls,text)=>Object.assign(document.createElement(tag),{className:cls,...(text==null?{}:{textContent:text})});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'Unresolved';
const act=(text,fn)=>{const b=make('button','btn',text);b.type='button';b.addEventListener('click',fn);return b;};
function clearPlots(host){host.querySelectorAll('.js-plotly-plot').forEach(disposePlot);host.replaceChildren();}
function plot(host,options){const el=make('div','engineering-chart');host.append(el);plotStudyCurves(el,options);}

export function mountFemWorkbench({settingsHost,resultsHost,getState,setSettings,onSettingsChange,theme}) {
  const settings=make('fieldset','application-settings');
  settings.append(make('legend','','1 · Choose your acoustic task'));
  const cards=make('div','application-cards'),inputs={};
  const initial=getState();
  for(const [key,app] of Object.entries(APPLICATIONS)){
    const label=make('label','application-choice'),radio=make('input','');
    radio.type='radio';radio.name='fem-application';radio.value=key;radio.checked=(initial.application||'tune')===key;
    radio.setAttribute('aria-label',app.title);inputs[key]=radio;
    label.append(radio,make('strong','',app.title),make('span','',app.description));cards.append(label);
    radio.addEventListener('change',()=>{updateVisible();onSettingsChange();});
  }
  settings.append(cards);
  const dimensions=make('div','application-dimensions');
  const application=()=>Object.keys(APPLICATIONS).find(key=>inputs[key].checked)||'tune';
  for(const [key,title,value,scale,min] of [
    ['targetFrequency','Target frequency (Hz)',initial.targetFrequency??150,1,.01],
    ['faceWidth','Square panel cell width (mm)',initial.faceWidth??.16,1000,.01],
    ['ductDiameter','Main duct internal diameter (mm)',initial.ductDiameter??.15,1000,.01]]){
    const label=make('label','',title),input=make('input','');input.type='number';input.min=min;input.step='any';input.value=value*scale;
    input.setAttribute('aria-label',title);input.dataset.scale=scale;label.append(input);inputs[key]=input;dimensions.append(label);
    input.addEventListener('change',onSettingsChange);
    input.addEventListener('input',onSettingsChange);
  }
  settings.append(dimensions);
  const mounting=make('p','note');settings.append(mounting);settingsHost.append(settings);
  function updateVisible(){
    const app=application();
    inputs.faceWidth.parentElement.hidden=app!=='absorber';inputs.ductDiameter.parentElement.hidden=app!=='duct';
    mounting.textContent=app==='tune'?'Isolated resonator in still air. Pressure gain uses a defined equivalent mouth drive; it does not measure absorption.'
      :app==='absorber'?'Mounting: rigid-backed panel, one resonator in each square cell, normal incidence. Cell width must fit the cavity. No diffuse-field or room absorption is predicted.'
      :'Mounting: one compact side branch on a straight circular duct, anechoic ends and no flow. Transmission loss describes this ideal duct arrangement, not room insertion loss.';
  }
  updateVisible();
  const summary=make('section','engineering-summary');summary.setAttribute('aria-label','Acoustic design results');
  const performance=make('section','application-performance');
  const impedance=make('details','engineering-details');impedance.append(make('summary','','Inspect mouth impedance'));
  const impedanceBody=make('div','');impedance.append(impedanceBody);
  const measurementPanel=make('details','engineering-details');measurementPanel.append(make('summary','','Verify with a reference curve · optional data comparison'));
  const measurementIntro=make('p','note','Compare another simulation or a future measurement. Import a local CSV with frequency_Hz and one response column: magnitude (Pa/Pa), magnitude_dB, absorption (0–1), or transmission_loss_dB. Match geometry, mounting, drive and receiver. Files stay in this browser and saved project.');
  const measurementActions=make('div','research-actions'),file=make('input','');file.type='file';file.accept='.csv,text/csv';file.hidden=true;
  const measurementStatus=make('p','note');measurementStatus.setAttribute('role','status');
  const measurementOutput=make('div','measurement-output');
  let currentResult=null,currentConvergence=[],busy=false;
  const importButton=act('Import reference CSV',()=>file.click());
  const templateButton=act('Download CSV template',()=>downloadBlob('resonlab-measurement-template.csv',
    '# source: Replace with test rig, sample, microphone/reference position and date\n# notes: Match geometry, environment and mounting; magnitude is linear pressure gain, not SPL\nfrequency_Hz,magnitude\n','text/csv'));
  const syntheticButton=act('Load synthetic check (not measured)',async()=>{
    try{const response=await fetch('./examples/response-reference.csv');if(!response.ok)throw new Error('Reference file unavailable.');loadMeasurement(await response.text(),'Synthetic 150 Hz / Q 50 check');}
    catch(error){measurementStatus.textContent=error.message;}
  });
  const removeButton=act('Remove comparison',()=>{setSettings({measurement:null});measurementStatus.textContent='Comparison removed.';renderMeasurement();});
  measurementActions.append(importButton,templateButton,syntheticButton,removeButton,file);
  const normalizeLabel=make('label','measurement-normalize'),normalize=make('input','');normalize.type='checkbox';normalize.checked=initial.normalizeMeasurement!==false;
  normalizeLabel.append(normalize,document.createTextNode(' Compare pressure shape (normalize each peak)'));
  normalize.addEventListener('change',()=>{setSettings({normalizeMeasurement:normalize.checked});renderMeasurement();});
  const sourceLabel=make('label','measurement-source','Measurement setup / provenance'),source=make('textarea','');source.rows=2;source.maxLength=1000;
  source.setAttribute('aria-label','Measurement setup / provenance');source.value=initial.measurement?.source||'';sourceLabel.append(source);
  source.addEventListener('change',()=>{const m=getState().measurement;if(m){setSettings({measurement:{...m,source:source.value}});renderMeasurement();}});
  measurementPanel.append(measurementIntro,measurementActions,normalizeLabel,sourceLabel,measurementStatus,measurementOutput);
  resultsHost.append(summary,performance,impedance,measurementPanel);
  function loadMeasurement(text,name){
    const data=parseMeasuredResponse(text,{name});setSettings({measurement:data});source.value=data.source;
    measurementStatus.textContent=`${data.points.length} samples loaded. ${data.kind==='synthetic'?'Synthetic reference, not an experimental benchmark.':data.kind==='simulation'?'Simulation reference; check the modelling assumptions.':'Imported data; conditions and provenance are user-supplied.'}`;
    measurementPanel.open=true;renderMeasurement();
  }
  file.addEventListener('change',async()=>{
    try{const selected=file.files?.[0];if(!selected)return;if(selected.size>1000000)throw new Error('Use a CSV smaller than 1 MB.');loadMeasurement(await selected.text(),selected.name);}
    catch(error){measurementStatus.textContent=`Import rejected: ${error.message} Previous comparison retained.`;}finally{file.value='';}
  });
  function renderMeasurement(){
    clearPlots(measurementOutput);removeButton.disabled=busy||!getState().measurement;
    const data=getState().measurement;normalizeLabel.hidden=data?.quantity!=='pressure';
    if(currentResult)delete currentResult.measurementComparison;
    if(!data){measurementOutput.append(make('p','note','No measurement loaded. The synthetic check exercises import and peak/Q extraction; it is not physical validation.'));return;}
    if(!currentResult?.response){measurementOutput.append(make('p','note','Solve the current model to compare it with the imported trace.'));return;}
    try{
      const comparison=compareMeasurement(data,currentResult,{normalize:normalize.checked}),measured=comparison.measuredFeatures;
      const title=data.kind==='synthetic'?'Synthetic comparison · not experimental validation':'Imported response comparison';
      measurementOutput.innerHTML=`<h3>${title}</h3><p class="note">${escape(data.name)} · ${escape(data.source)}</p>
        <table class="result-table"><tbody><tr><th>Model peak / imported peak</th><td>${fmt(comparison.modelPeak)} / ${fmt(measured.peak?.f)} Hz</td></tr>
        <tr><th>Peak difference (model − imported)</th><td>${comparison.peakDifference===null?'Unresolved':fmt(comparison.peakDifference*100)+'%'}</td></tr>
        ${data.quantity==='pressure'?`<tr><th>Model Q / imported bandwidth Q</th><td>${fmt(comparison.modelQ)} / ${fmt(measured.Q)}</td></tr>`:''}
        <tr><th>Curve RMSE over overlap</th><td>${fmt(comparison.rmse,3)} ${data.quantity==='absorption'?'coefficient': 'dB'}${comparison.shape?' · peaks normalized':''}</td></tr></tbody></table>
        <p class="note">${escape(comparison.note)} Imported peaks use sampled values; crossings use linear interpolation of squared magnitude. Curve error uses interpolation of the solved model.</p>
        ${measured.warnings.map(w=>`<p class="note">${escape(w)}</p>`).join('')}`;
      if(measurementPanel.open)plot(measurementOutput,{curves:[{name:'FEM prediction',x:comparison.overlayModel.map(p=>p.f),y:comparison.overlayModel.map(p=>p.value)},
        {name:data.kind==='synthetic'?'Synthetic check':'Imported data',x:comparison.overlayMeasured.map(p=>p.f),y:comparison.overlayMeasured.map(p=>p.value),markers:true,dash:true}],
        title:'Model and imported response · '+(comparison.shape?'peak-normalized':'original scale'),yLabel:comparison.unit,theme});
      currentResult.measurementComparison={measurement:data,...comparison};
    }catch(error){measurementOutput.append(make('p','note',error.message));}
  }
  function draw(result,convergence=[]){
    currentResult=result;currentConvergence=convergence;clearPlots(performance);clearPlots(impedanceBody);summary.replaceChildren();
    if(!result){summary.append(make('p','note','2 · Solve the current geometry, then read performance for your chosen application.'));renderMeasurement();return;}
    const p=result.performance,r=result.response,app=p?.application||application();
    summary.innerHTML=`<span class="guide-eyebrow">AXISYMMETRIC FEM · ${escape(APPLICATIONS[app]?.title||'Helmholtz study')}</span>
      <h3>2 · Read the result for your application</h3><div class="result-metrics">
      <div><span>Lumped estimate</span><strong>${fmt(result.comparison.lumpedHz)} Hz</strong></div>
      <div><span>Lossless FEM mode</span><strong>${fmt(result.modes[0].f)} Hz</strong></div>
      <div><span>Isolated damped peak</span><strong>${fmt(r?.peak?.f)} Hz</strong></div>
      <div><span>Isolated bandwidth Q</span><strong>${fmt(r?.Q)}</strong></div></div>`;
    const last=convergence.at(-1),previous=convergence.at(-2);
    const df=previous?Math.abs(last.f-previous.f)/previous.f:null,dq=previous&&last.Q!=null&&previous.Q!=null?Math.abs(last.Q-previous.Q)/previous.Q:null;
    const mounted=app!=='tune';
    const mountedChange=previous&&last.applicationValue!=null&&previous.applicationValue!=null?Math.abs(last.applicationValue-previous.applicationValue):null;
    const mountedFrequency=previous&&last.applicationPeak!=null&&previous.applicationPeak!=null?Math.abs(last.applicationPeak-previous.applicationPeak)/previous.applicationPeak:null;
    const checked=df!==null&&dq!==null&&(!mounted||mountedChange!==null&&mountedFrequency!==null);
    const settled=checked&&df<.005&&dq<.02&&(!mounted||mountedFrequency<.005&&mountedChange<(app==='absorber'?.01:.2));
    const confidence=make('div','confidence-strip');
    confidence.append(make('strong','',checked?(settled?'Mesh refinement checked':'Refine further before relying on this result'):'Mesh refinement not checked'));
    confidence.append(make('span','',checked?`Latest mesh changes: isolated frequency ${(100*df).toFixed(3)}% · Q ${(100*dq).toFixed(2)}%. ${mounted?`Mounted peak shift ${(100*mountedFrequency).toFixed(3)}%; ${app==='absorber'?'absorption change '+(100*mountedChange).toFixed(3)+' percentage points':'TL change '+mountedChange.toFixed(3)+' dB'}. `:''}This is numerical convergence, not experimental validation.`:'Run Check mesh convergence to compare frequency, Q and mounted performance. Small equation residuals alone do not establish mesh accuracy.'));
    summary.append(confidence);
    const verify=make('a','btn','Run physics verification suite');verify.href='tests/index.html';verify.target='_blank';verify.rel='noopener';summary.append(verify);
    if(r?.warnings.length){for(const warning of r.warnings)summary.append(make('p','model-warning',warning));}
    if(!p){performance.append(make('p','model-warning',result.performanceError||result.responseError||'Application results need a new solve.'));renderMeasurement();return;}
    const target=p.target,peak=p.peak;
    const title=app==='tune'?'Isolated resonator tuning':APPLICATIONS[app].result;
    performance.append(make('h3','',title));
    const metrics=make('div','result-metrics');
    if(app==='tune'){
      const delta=r?.peak?(r.peak.f-p.targetFrequency)/p.targetFrequency*100:null;
      metrics.innerHTML=`<div><span>Target</span><strong>${fmt(p.targetFrequency)} Hz</strong></div><div><span>Peak error vs target</span><strong>${delta===null?'Unresolved':(delta>0?'+':'')+fmt(delta)+'%'}</strong></div>`;
    }else{
      const key=app==='absorber'?'alpha':'TLdB',unit=app==='absorber'?'%':' dB',scale=app==='absorber'?100:1;
      metrics.innerHTML=`<div><span>Best resolved ${app==='absorber'?'absorption':'transmission loss'}</span><strong>${peak?fmt(peak[key]*scale)+unit:'Sweep edge / unresolved'}</strong></div>
        <div><span>Mounted peak frequency</span><strong>${fmt(peak?.f)} Hz</strong></div>
        <div><span>At target ${fmt(p.targetFrequency)} Hz</span><strong>${target?fmt(target[key]*scale)+unit:'Outside sweep'}</strong></div>`;
    }
    performance.append(metrics,make('p','note',p.assumptions));
    if(app==='absorber'&&peak){
      const ratio=peak.surfaceResistance/(r.losses.rho*result.c),x=peak.surfaceReactance/(r.losses.rho*result.c);
      performance.append(make('p','note',`Impedance matching at the absorption peak: resistance / air impedance = ${ratio.toFixed(3)}; reactance / air impedance = ${x.toFixed(3)}. The ideal normal-incidence match is 1 and 0. ${ratio<.8?'This design has too little resistance for this cell area; controlled additional damping may improve absorption.':ratio>1.2?'This design is over-resistive for this cell area.':'Resistance is near the matching range; inspect reactance and sweep width.'}`));
    }
    if(app==='duct'&&peak)performance.append(make('p','note',`At the transmission-loss peak: ${(100*peak.transmission).toFixed(1)}% transmitted, ${(100*peak.reflection).toFixed(1)}% reflected, ${(100*peak.dissipation).toFixed(1)}% dissipated. Plane-wave cutoff for this duct: ${p.ductCutoff.toFixed(0)} Hz.`));
    if(app!=='tune'){
      plot(performance,{curves:[{name:app==='absorber'?'Absorbed fraction':'Transmission loss',x:p.rows.map(v=>v.f),y:p.rows.map(v=>app==='absorber'?v.alpha:Number.isFinite(v.TLdB)?v.TLdB:null)}],
        title:APPLICATIONS[app].result,yLabel:app==='absorber'?'Absorption coefficient (0–1)':'Transmission loss (dB)',theme,...(app==='absorber'?{yRange:[0,1]}:{})});
      performance.append(make('p','note',app==='absorber'?'Absorption is derived from the mounted surface impedance. A pressure peak or high Q alone does not establish high absorption.':'Reflected and dissipated sound both reduce transmission. Transmission loss is not the same as absorption.'));
    }
    p.warnings.forEach(w=>performance.append(make('p','model-warning',w)));
    if(impedance.open)plot(impedanceBody,{curves:[{name:'Interior resistance',x:p.rows.map(v=>v.f),y:p.rows.map(v=>v.resistance)},
      {name:'Interior reactance',x:p.rows.map(v=>v.f),y:p.rows.map(v=>v.reactance)}],title:'Resonator mouth impedance · exterior load excluded',yLabel:'Acoustic impedance (Pa·s/m³)',theme});
    impedanceBody.append(make('p','note',p.port+' '+p.loading));
    performance.append(act('Export application performance CSV',()=>downloadApplicationPerformanceCSV(p)));
    renderMeasurement();
  }
  function setBusy(value){busy=value;settings.disabled=value;importButton.disabled=syntheticButton.disabled=value;removeButton.disabled=value||!getState().measurement;normalize.disabled=source.disabled=value;}
  impedance.addEventListener('toggle',()=>{if(impedance.open&&currentResult)draw(currentResult,currentConvergence);else clearPlots(impedanceBody);});
  measurementPanel.addEventListener('toggle',renderMeasurement);
  draw(null);
  return {draw,setBusy,measurementPanel,settings:()=>({application:application(),...Object.fromEntries(['targetFrequency','faceWidth','ductDiameter'].map(key=>[key,Number(inputs[key].value)/Number(inputs[key].dataset.scale)]))})};
}
