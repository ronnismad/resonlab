/** Local CSV comparison, independent of DOM and solver. Never fits the model
 * to the measurement or labels a generated reference as experimental data. */
function cells(line) {
  const out=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){out.push(value.trim());value='';}else value+=c;
  }
  if(quoted)throw new Error('Unclosed CSV quote. Use one record per line.');
  out.push(value.trim());return out;
}
export function parseMeasuredResponse(text,{name='Imported response'}={}) {
  if(typeof text!=='string'||text.length>1000000)throw new Error('Use a CSV file smaller than 1 MB.');
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),meta={},records=[];
  for(const line of lines){if(line.startsWith('#')){const i=line.indexOf(':');if(i>1)meta[line.slice(1,i).trim().toLowerCase()]=line.slice(i+1).trim();}else records.push(line);}
  if(records.length<4||records.length>10001)throw new Error('CSV needs a header and 3–10000 data rows.');
  const header=cells(records[0]).map(s=>s.toLowerCase());
  if(new Set(header).size!==header.length)throw new Error('CSV column names must be unique.');
  const fcol=header.indexOf('frequency_hz');
  const keys=['magnitude','magnitude_db','absorption','transmission_loss_db'];
  const kind=keys.find(k=>header.includes(k));
  if(fcol<0||!kind)throw new Error('Use frequency_Hz and magnitude (linear Pa/Pa), magnitude_dB (20 log10 Pa/Pa), absorption (0–1), or transmission_loss_dB.');
  // Linear and dB columns in a ResonLab response export describe the same trace.
  if(header.includes('absorption')&&(header.includes('magnitude')||header.includes('magnitude_db')||header.includes('transmission_loss_db'))||header.includes('transmission_loss_db')&&(header.includes('magnitude')||header.includes('magnitude_db')))throw new Error('Import one response quantity per CSV.');
  const vcol=header.indexOf(kind),points=records.slice(1).map((line,i)=>{
    const row=cells(line);
    if(row.length!==header.length||row[fcol]===''||row[vcol]==='')throw new Error(`Missing or extra CSV values on data row ${i+1}.`);
    const f=Number(row[fcol]),raw=Number(row[vcol]);
    if(!Number.isFinite(f)||f<=0||!Number.isFinite(raw))throw new Error(`Data row ${i+1} needs finite values and a positive frequency.`);
    const value=kind==='magnitude_db'?10**(raw/20):raw;
    if(!Number.isFinite(value)||value<0||kind==='absorption'&&value>1)throw new Error(`Data row ${i+1} is outside the allowed range.`);
    return {f,value};
  }).sort((a,b)=>a.f-b.f);
  if(points.some((p,i)=>i&&p.f===points[i-1].f))throw new Error('Duplicate frequencies are ambiguous. Average repeated measurements before importing.');
  if(!points.some(p=>p.value>0))throw new Error('The response contains no positive values.');
  return {name:String(name).slice(0,160),kind:meta.provenance==='synthetic'?'synthetic':meta.provenance==='simulation'?'simulation':'imported',
    quantity:kind==='magnitude'||kind==='magnitude_db'?'pressure':kind==='absorption'?'absorption':'transmission',
    points,source:meta.source||'User-supplied CSV; measurement conditions have not been verified.',notes:meta.notes||''};
}

export function responseFeatures(points,{pressure=false}={}) {
  if(points.length<3)return {peak:null,Q:null,bandwidth:null,warnings:['Fewer than three overlapping samples.']};
  const index=points.reduce((best,p,i)=>p.value>points[best].value?i:best,0),peak=points[index],warnings=[];
  if(index===0||index===points.length-1)return {peak:null,Q:null,bandwidth:null,warnings:['Imported peak is at the range edge; widen the measurement range.']};
  let Q=null,bandwidth=null,fLower=null,fUpper=null;
  if(pressure){
    const target=peak.value**2/2;
    const cross=(a,b)=>a.f+(b.f-a.f)*(target-a.value**2)/(b.value**2-a.value**2);
    for(let i=index-1;i>=0;i--)if(points[i].value**2<=target){fLower=cross(points[i],points[i+1]);break;}
    for(let i=index+1;i<points.length;i++)if(points[i].value**2<=target){fUpper=cross(points[i-1],points[i]);break;}
    if(fLower!==null&&fUpper!==null){
      bandwidth=fUpper-fLower;Q=peak.f/bandwidth;
      const near=points.filter(p=>p.f>=fLower&&p.f<=fUpper);
      if(near.length<5)warnings.push('Fewer than five measured samples inside the half-power bandwidth; Q is poorly resolved.');
    }else warnings.push('Measured half-power crossings are missing; measured Q is unresolved.');
  }
  return {peak,Q,bandwidth,fLower,fUpper,warnings};
}

export function restoreMeasurement(data) {
  if(data==null)return null;
  if(!data||!['pressure','absorption','transmission'].includes(data.quantity)||!Array.isArray(data.points)||data.points.length<3||data.points.length>10000)throw new Error('Invalid saved measurement data.');
  const points=data.points.map((p,i)=>{
    if(!p||!Number.isFinite(p.f)||p.f<=0||!Number.isFinite(p.value)||p.value<0||data.quantity==='absorption'&&p.value>1||i&&p.f<=data.points[i-1].f)throw new Error('Saved measurement needs finite, ordered, unique frequencies and valid response values.');
    return {f:p.f,value:p.value};
  });
  if(!points.some(p=>p.value>0))throw new Error('Saved measurement has no positive response.');
  return {name:String(data.name||'Imported response').slice(0,160),quantity:data.quantity,kind:['synthetic','simulation'].includes(data.kind)?data.kind:'imported',points,
    source:String(data.source||'User-supplied CSV; setup unverified.').slice(0,1000),notes:String(data.notes||'').slice(0,1000)};
}

export function interpolateTrace(points,f) {
  if(!points.length||f<points[0].f||f>points.at(-1).f)return null;
  let lo=0,hi=points.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid].f<=f)lo=mid;else hi=mid;}
  if(points[lo].f===f||lo===hi)return points[lo].value;
  return points[lo].value+(points[hi].value-points[lo].value)*(f-points[lo].f)/(points[hi].f-points[lo].f);
}

export function compareMeasurement(measurement,result,{normalize=true}={}) {
  const application=result.performance?.application||'tune';
  const quantity=application==='absorber'?'absorption':application==='duct'?'transmission':'pressure';
  if(measurement.quantity!==quantity)throw new Error(`This study predicts ${quantity}; import that quantity or change the application.`);
  const predicted=quantity==='pressure'?result.response.freqs.map((f,i)=>({f,value:result.response.mag[i]}))
    :result.performance.rows.map(p=>({f:p.f,value:quantity==='absorption'?p.alpha:p.TLdB}));
  const measured=measurement.points.filter(p=>p.f>=predicted[0].f&&p.f<=predicted.at(-1).f);
  if(measured.length<3)throw new Error('At least three measured frequencies must overlap the model sweep.');
  const modelOverlap=[{f:measured[0].f,value:interpolateTrace(predicted,measured[0].f)},
    ...predicted.filter(p=>p.f>measured[0].f&&p.f<measured.at(-1).f),
    {f:measured.at(-1).f,value:interpolateTrace(predicted,measured.at(-1).f)}];
  const measuredFeatures=responseFeatures(measured,{pressure:quantity==='pressure'});
  const modelFeatures=responseFeatures(modelOverlap,{pressure:quantity==='pressure'});
  const measuredMax=Math.max(...measured.map(p=>p.value)),modelMax=Math.max(...modelOverlap.map(p=>p.value));
  const shape=normalize&&quantity==='pressure';
  const transform=(v,max)=>quantity==='pressure'?20*Math.log10(Math.max(v/(shape?max:1),1e-15)):v;
  const overlayMeasured=measured.map(p=>({f:p.f,value:transform(p.value,measuredMax)}));
  const overlayModel=predicted.map(p=>({f:p.f,value:transform(p.value,modelMax)}));
  const rmse=Math.sqrt(measured.reduce((s,p)=>s+(transform(p.value,measuredMax)-transform(interpolateTrace(predicted,p.f),modelMax))**2,0)/measured.length);
  // Q of the complete FEM pressure response is more accurate than interpolation.
  const fullPeak=quantity==='pressure'?result.response.peak?.f:result.performance.peak?.f;
  const modelPeak=fullPeak>=measured[0].f&&fullPeak<=measured.at(-1).f?fullPeak:null;
  const modelQ=quantity==='pressure'&&modelPeak!==null?result.response.Q:null;
  const peakDifference=measuredFeatures.peak&&modelPeak?(modelPeak-measuredFeatures.peak.f)/measuredFeatures.peak.f:null;
  return {quantity,shape,overlayMeasured,overlayModel,measuredFeatures,modelFeatures,modelQ,modelPeak,peakDifference,rmse,
    unit:quantity==='pressure'?(shape?'dB relative to each peak':'dB re 1 Pa/Pa'):quantity==='absorption'?'Absorption coefficient':'Transmission loss (dB)',
    note:measurement.kind==='synthetic'?'Synthetic reference: checks the comparison workflow; it does not validate a physical resonator.'
      :measurement.kind==='simulation'?'Imported simulation reference. Compare model assumptions, geometry, loading and source/receiver definitions; agreement is not experimental validation. No parameters have been fitted.'
      :'User-supplied measurement. Differences are meaningful only for matching geometry, medium, mounting, drive and receiver. No model parameters have been fitted.'};
}
