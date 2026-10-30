/** Bounded inverse design. Joint targets dispatch to the driven FEM optimizer.
 * Lossless eigenmodes bracket a candidate; full driven solves refine the actual
 * requested peak. No fitted/lumped Helmholtz frequency is used as an answer. */
import { helmholtzFemGeometry, helmholtzModesFEM } from './helmholtz-fem.js?v=20261027';
import { helmholtzFrequencyResponse } from './helmholtz-response.js?v=20261027';
import { helmholtzPortPerformance } from './acoustic-performance.js?v=20261031';
import { multiDesignHelmholtzFEM } from './fem-multi-design.js?v=20261101';

export const FEM_DESIGN_BOUNDS={volume:[.00005,.05],neckLength:[.001,.5],neckRadius:[.001,.05],scale:[.25,4],cavityAspectRatio:[.1,5]};
export function geometryForDesign(base,parameter,value){
  if(parameter==='scale')return {...base,volume:base.volume*value**3,neckRadius:base.neckRadius*value,neckLength:base.neckLength*value};
  return {...base,[parameter]:value};
}
export function designMetric(result,metric,application){
  if(metric==='lossless')return result.modes[0].f;
  if(application==='tune')return result.response?.peak?.f??null;
  return result.performance?.peak?.f??null;
}
function feasibleBounds(base,parameter,bounds,application,faceWidth,ductDiameter){
  const g=helmholtzFemGeometry(base),aspect=g.cavityAspectRatio;
  let [lo,hi]=bounds;
  if(parameter==='volume'){
    lo=Math.max(lo,2*Math.PI*aspect*(g.neckRadius*1.001)**3);
    if(application==='absorber')hi=Math.min(hi,2*Math.PI*aspect*(faceWidth/2)**3);
  }else if(parameter==='neckRadius'){
    hi=Math.min(hi,g.radius*.999);
    if(application==='duct')hi=Math.min(hi,ductDiameter/2*.999);
  }else if(parameter==='scale'){
    if(application==='absorber')hi=Math.min(hi,faceWidth/(2*g.radius));
    if(application==='duct')hi=Math.min(hi,ductDiameter/(2*g.neckRadius)*.999);
  }
  if(!(hi>lo))throw new Error(`No feasible ${parameter} range remains after geometry and mounting limits.`);
  for(const value of [lo,hi]){
    const candidate=helmholtzFemGeometry(geometryForDesign(base,parameter,value));
    if(application==='absorber'&&2*candidate.radius>faceWidth*(1+1e-12))throw new Error('Cavity does not fit the panel cell within these limits.');
    if(application==='duct'&&2*candidate.neckRadius>=ductDiameter)throw new Error('Neck does not fit the main duct within these limits.');
  }
  return [lo,hi];
}

export function inverseDesignHelmholtzFEM({geometry,c=343,level='medium',targetFrequency,
  parameter='auto',metric='application',application='tune',faceWidth=.16,ductDiameter=.15,
  losses={},bounds={},tolerance=.001,maxIterations=32,maxRefinements=6,onProgress,
  mode='frequency',targetQ,qTolerance,dimensions,sizeLimits,maxEvaluations}={}){
  if(mode==='frequency-q')return multiDesignHelmholtzFEM({geometry,c,level,targetFrequency,targetQ,metric,application,faceWidth,ductDiameter,losses,bounds,tolerance,qTolerance,dimensions,sizeLimits,maxEvaluations,onProgress});
  if(mode!=='frequency')throw new Error('Choose frequency-only or joint frequency and Q design.');
  helmholtzFemGeometry(geometry);
  if(!Number.isFinite(targetFrequency)||targetFrequency<=0)throw new Error('Target frequency must be finite and greater than zero.');
  if(!Number.isFinite(c)||c<=0||!['coarse','medium','fine'].includes(level))throw new Error('Choose a valid medium and FEM mesh.');
  if(!['auto','volume','neckLength','neckRadius','scale'].includes(parameter)||!['application','lossless'].includes(metric)||!['tune','absorber','duct'].includes(application))throw new Error('Unknown design parameter, frequency definition or application.');
  if(!Number.isFinite(tolerance)||tolerance<.0001||tolerance>.02||!Number.isInteger(maxIterations)||maxIterations<4||maxIterations>48||!Number.isInteger(maxRefinements)||maxRefinements<1||maxRefinements>8)throw new Error('Design tolerance must be 0.01–2%; use 4–48 search iterations and 1–8 peak refinements.');
  if(application==='absorber'&&(!Number.isFinite(faceWidth)||faceWidth<=0)||application==='duct'&&(!Number.isFinite(ductDiameter)||ductDiameter<=0))throw new Error('A positive mounting dimension is required.');
  const limits={...FEM_DESIGN_BOUNDS,...bounds};
  for(const [name,range] of Object.entries(limits))if(!FEM_DESIGN_BOUNDS[name]||!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[0]<0||range[1]<=range[0]||name!=='neckLength'&&range[0]===0)throw new Error(`Invalid ${name} bounds: enter a finite increasing range.`);
  const trace=[],attempts=[];let eigenSolves=0,verifications=0,best=null;
  const error=f=>(f-targetFrequency)/targetFrequency;
  const publish=(stage,p,value,f)=>{const row={stage,parameter:p,value,frequency:f,error:error(f)};trace.push(row);onProgress?.({...row,stage:'inverse',phase:stage,eigenSolves,verifications});};
  const parameters=parameter==='auto'?['volume','neckLength','neckRadius']:[parameter];
  for(const p of parameters){
    let lo,hi;
    try{[lo,hi]=feasibleBounds(geometry,p,limits[p],application,faceWidth,ductDiameter);}
    catch(e){attempts.push({parameter:p,status:'infeasible',message:e.message});continue;}
    const cache=new Map();
    const at=value=>{
      const key=value.toPrecision(15);
      if(!cache.has(key)){
        const result=helmholtzModesFEM({geometry:geometryForDesign(geometry,p,value),c,level,nModes:1});eigenSolves++;
        const f=result.modes[0].f;cache.set(key,{value,f});publish('lossless search',p,value,f);
      }
      return cache.get(key);
    };
    try{
      let a=at(lo),b=at(hi),candidate=Math.abs(error(a.f))<Math.abs(error(b.f))?a:b;
      const rangeHz=[Math.min(a.f,b.f),Math.max(a.f,b.f)];
      const bracketed=error(a.f)*error(b.f)<=0;
      const initialValue=p==='scale'?1:geometry[p];
      if(initialValue>=lo&&initialValue<=hi){const initial=at(initialValue);if(Math.abs(error(initial.f))<Math.abs(error(candidate.f)))candidate=initial;}
      if(bracketed){
        for(let iteration=0;iteration<maxIterations&&Math.abs(error(candidate.f))>tolerance*.2;iteration++){
          const value=a.value>0?Math.sqrt(a.value*b.value):(a.value+b.value)/2;
          const mid=at(value);if(Math.abs(error(mid.f))<Math.abs(error(candidate.f)))candidate=mid;
          if(error(a.f)*error(mid.f)<=0)b=mid;else a=mid;
        }
      }else if(metric==='lossless'){
        attempts.push({parameter:p,status:'unreachable',rangeHz,bounds:[lo,hi],message:'Target is outside the lossless FEM range for these limits.'});continue;
      }
      // An application peak may lie outside the lossless frequency range under
      // strong damping. Verify the endpoint instead of rejecting it by a
      // surrogate frequency threshold; bounded corrections can move inward.
      let value=candidate.value,previous=null,verified=null;
      for(let refinement=0;refinement<(metric==='lossless'?1:maxRefinements);refinement++){
        const trialGeometry=geometryForDesign(geometry,p,value);
        const result=helmholtzModesFEM({geometry:trialGeometry,c,level,nModes:6});eigenSolves++;verifications++;
        // Fixed local verification sweep deliberately includes the fundamental;
        // it is independent of any incomplete user display sweep.
        try{result.response=helmholtzFrequencyResponse({result,losses,nSamples:81});}
        catch(e){result.responseError=e.message;if(metric!=='lossless')throw e;}
        if(result.response){
          try{result.performance=helmholtzPortPerformance({result,application,faceWidth,ductDiameter,targetFrequency});}
          catch(e){result.performanceError=e.message;if(metric!=='lossless'&&application!=='tune')throw e;}
        }
        const f=designMetric(result,metric,application);
        if(!Number.isFinite(f)||f<=0)throw new Error('The requested peak is not resolved. Adjust losses, dimensions or frequency definition.');
        publish('full verification',p,value,f);
        verified={geometry:trialGeometry,parameter:p,value,frequency:f,relativeError:error(f),result,bounds:[lo,hi]};
        if(!best||Math.abs(verified.relativeError)<Math.abs(best.relativeError))best=verified;
        if(Math.abs(verified.relativeError)<=tolerance){
          return {status:'converged',targetFrequency,metric,application,tolerance,level,c,losses:{...losses},faceWidth,ductDiameter,originalGeometry:{...geometry},
            ...verified,trace,attempts,eigenSolves,verifications,
            note:'One parameter varied; other dimensions and cavity aspect ratio retained (scale varies all physical lengths). Verified on the selected FEM mesh. Frequency matching does not optimize absorption, Q, bandwidth or manufacturing robustness; check mesh convergence after applying.'};
        }
        let next;
        // A secant step in log coordinates follows verified peak frequencies.
        if(value>0&&previous?.value>0&&previous.f!==f){
          const slope=Math.log(f/previous.f)/Math.log(value/previous.value);
          if(Number.isFinite(slope)&&Math.abs(slope)>.01)next=value*Math.exp(-Math.log(f/targetFrequency)/slope);
        }
        if(!Number.isFinite(next)){
          const low=at(lo),high=at(hi);
          if(lo>0&&value>0){const slope=Math.log(high.f/low.f)/Math.log(hi/lo);next=value*Math.exp(-Math.log(f/targetFrequency)/slope);}
          else next=value-(f-targetFrequency)*(hi-lo)/(high.f-low.f);
        }
        next=Math.min(hi,Math.max(lo,next));
        if(!Number.isFinite(next)||Math.abs(next-value)<Math.max(1e-12,Math.abs(value)*1e-8))break;
        previous={value,f};value=next;
      }
      attempts.push({parameter:p,status:'not-converged',rangeHz,bounds:[lo,hi],frequency:verified?.frequency??null,message:'No verified frequency match within the permitted bounds and refinement limit.'});
    }catch(e){attempts.push({parameter:p,status:'failed',bounds:[lo,hi],message:e.message});}
  }
  return {status:best?'not-converged':'unreachable',targetFrequency,metric,application,tolerance,level,c,originalGeometry:{...geometry},
    best:best?{geometry:best.geometry,parameter:best.parameter,value:best.value,frequency:best.frequency,relativeError:best.relativeError}:null,
    attempts,trace,eigenSolves,verifications,note:'No verified design met the target within these limits. Widen the bounds, change the adjustable parameter, or review mounting constraints. Current geometry has not changed.'};
}
