/** Joint frequency / bandwidth-Q design with hard acoustic-envelope limits.
 * Every objective value comes from a driven FEM solve. Exploration uses a
 * coarse mesh; acceptance requires fresh verification on the requested mesh.
 */
import { helmholtzFemGeometry, helmholtzModesFEM } from './helmholtz-fem.js?v=20261027';
import { helmholtzFrequencyResponse } from './helmholtz-response.js?v=20261027';
import { helmholtzPortPerformance } from './acoustic-performance.js?v=20261031';

export const MULTI_DIMENSIONS=['volume','neckLength','neckRadius','cavityAspectRatio'];
export const DEFAULT_SIZE_LIMITS={maxDiameter:.16,maxHeight:.3,allowance:.002};
const DEFAULT_BOUNDS={volume:[.00005,.05],neckLength:[.001,.5],neckRadius:[.001,.05],cavityAspectRatio:[.1,5]};
const OFFSET=.0001;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

export function resonatorEnvelope(geometry,sizeLimits=DEFAULT_SIZE_LIMITS){
  const g=helmholtzFemGeometry(geometry),t=sizeLimits.allowance??0;
  if(!Number.isFinite(t)||t<0)throw new Error('Size allowance must be finite and nonnegative.');
  const diameter=2*(g.radius+t),height=g.height+g.neckLength+2*t;
  return {diameter,height,boundingVolume:Math.PI*diameter**2/4*height,allowance:t};
}
export function envelopeFits(geometry,sizeLimits){
  const e=resonatorEnvelope(geometry,sizeLimits);
  return e.diameter<=sizeLimits.maxDiameter*(1+1e-9)&&e.height<=sizeLimits.maxHeight*(1+1e-9);
}
function linearSolve(A,b){
  const n=b.length,a=A.map((row,i)=>[...row,b[i]]);
  for(let k=0;k<n;k++){
    let pivot=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[pivot][k]))pivot=i;
    if(Math.abs(a[pivot][k])<1e-20)return null;
    [a[k],a[pivot]]=[a[pivot],a[k]];
    for(let i=k+1;i<n;i++){const m=a[i][k]/a[k][k];for(let j=k;j<=n;j++)a[i][j]-=m*a[k][j];}
  }
  const x=new Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=a[i][n];for(let j=i+1;j<n;j++)s-=a[i][j]*x[j];x[i]=s/a[i][i];}return x;
}

export function multiDesignHelmholtzFEM({geometry,c=343,level='medium',targetFrequency,targetQ,
  metric='application',application='tune',faceWidth=.16,ductDiameter=.15,losses={},bounds={},
  dimensions=MULTI_DIMENSIONS,sizeLimits=DEFAULT_SIZE_LIMITS,tolerance=.001,qTolerance=.02,
  maxEvaluations=100,onProgress}={}){
  const base={...geometry,cavityAspectRatio:geometry?.cavityAspectRatio??1},baseGeometry=helmholtzFemGeometry(base);
  if(![targetFrequency,targetQ,c].every(v=>Number.isFinite(v)&&v>0))throw new Error('Frequency, target Q and sound speed must be finite and positive.');
  if(!['coarse','medium','fine'].includes(level)||!['application','lossless'].includes(metric)||!['tune','absorber','duct'].includes(application))throw new Error('Invalid mesh, frequency definition or application.');
  if(!Array.isArray(dimensions)||new Set(dimensions).size!==dimensions.length||dimensions.length<2||dimensions.some(k=>!MULTI_DIMENSIONS.includes(k)))throw new Error('Select at least two distinct adjustable dimensions for frequency and Q design.');
  if(!Number.isFinite(tolerance)||tolerance<.0001||tolerance>.02||!Number.isFinite(qTolerance)||qTolerance<.001||qTolerance>.2)throw new Error('Frequency tolerance must be 0.01–2%; Q tolerance must be 0.1–20%.');
  if(!Number.isInteger(maxEvaluations)||maxEvaluations<16||maxEvaluations>240)throw new Error('Use a search budget of 16–240 FEM trials.');
  const limits={...DEFAULT_SIZE_LIMITS,...sizeLimits};
  if(![limits.maxDiameter,limits.maxHeight].every(v=>Number.isFinite(v)&&v>0&&v<=100)||!Number.isFinite(limits.allowance)||limits.allowance<0||2*limits.allowance>=Math.min(limits.maxDiameter,limits.maxHeight))throw new Error('Overall diameter/height must be positive and larger than twice the size allowance.');
  if(application==='absorber'&&(!Number.isFinite(faceWidth)||faceWidth<=2*limits.allowance)||application==='duct'&&(!Number.isFinite(ductDiameter)||ductDiameter<=2*limits.allowance))throw new Error('Mounting size must exceed twice the size allowance.');
  if(losses.radiation===false&&losses.viscous===false&&losses.thermal===false&&!(losses.extraLoss>0))throw new Error('Enable at least one loss mechanism to target a finite bandwidth Q.');
  if(!(baseGeometry.mouthDelta>0))throw new Error('Use a flanged or unflanged mouth to compute the driven bandwidth Q.');
  if(![losses.rho??1.2,losses.mu??1.81e-5,losses.Pr??.71].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(losses.gamma??1.4)||(losses.gamma??1.4)<=1||!Number.isFinite(losses.extraLoss??0)||(losses.extraLoss??0)<0||(losses.extraLoss??0)>1)throw new Error('Invalid fluid properties or additional loss factor.');
  const ranges={...DEFAULT_BOUNDS,...bounds};
  if(Object.keys(bounds).some(key=>!MULTI_DIMENSIONS.includes(key)&&key!=='scale'))throw new Error('Unknown dimension bound in joint design.');
  for(const key of MULTI_DIMENSIONS){const r=ranges[key];if(!Array.isArray(r)||r.length!==2||!r.every(Number.isFinite)||r[1]<=r[0]||r[0]<(key==='neckLength'?0:1e-12))throw new Error(`Invalid ${key} bounds.`);}
  for(const key of MULTI_DIMENSIONS)if(!dimensions.includes(key)&&(base[key]<ranges[key][0]||base[key]>ranges[key][1]))throw new Error(`Fixed ${key} is outside its bounds. Adjust the bounds or unlock that dimension.`);
  const active=MULTI_DIMENSIONS.map((key,i)=>dimensions.includes(key)?i:-1).filter(i=>i>=0);
  const encode=g=>MULTI_DIMENSIONS.map(k=>Math.log(g[k]+(k==='neckLength'?OFFSET:0)));
  const decode=x=>({...base,...Object.fromEntries(MULTI_DIMENSIONS.map((k,i)=>[k,!dimensions.includes(k)?base[k]:k==='neckLength'?Math.max(0,Math.exp(x[i])-OFFSET):Math.exp(x[i])]))});
  const start=encode(base),lower=encode(Object.fromEntries(MULTI_DIMENSIONS.map(k=>[k,ranges[k][0]]))),upper=encode(Object.fromEntries(MULTI_DIMENSIONS.map(k=>[k,ranges[k][1]])));
  MULTI_DIMENSIONS.forEach((key,i)=>{if(!dimensions.includes(key))lower[i]=upper[i]=start[i];});
  const radiusCap=Math.min((limits.maxDiameter-2*limits.allowance)/2,application==='absorber'?(faceWidth-2*limits.allowance)/2:Infinity);
  const heightCap=limits.maxHeight-2*limits.allowance;
  // Radius and cavity height are affine in log(V),log(aspect). Total height
  // is log-sum-exp of cavity height and the offset neck length: convex.
  const constraints=x=>{
    const logR=(x[0]-Math.log(2*Math.PI)-x[3])/3,logH=Math.log(2)+logR+x[3];
    const H=Math.exp(logH),L=Math.exp(x[1]),sum=H+L;
    return [
      {g:logR-Math.log(radiusCap),a:[1/3,0,0,-1/3]},
      {g:x[2]-logR-Math.log(.999),a:[-1/3,0,1,1/3]},
      {g:Math.log(sum)-Math.log(heightCap+OFFSET),a:[H/(3*sum),L/sum,0,2*H/(3*sum)]},
      ...(application==='duct'?[{g:x[2]-Math.log(.999*(ductDiameter/2-limits.allowance)),a:[0,0,1,0]}]:[]),
    ];
  };
  const project=input=>{
    const x=input.map((v,i)=>clamp(v,lower[i],upper[i]));
    for(let pass=0;pass<400;pass++){
      let violation=0;
      for(const con of constraints(x))if(con.g>1e-11){
        violation=Math.max(violation,con.g);const norm=active.reduce((s,i)=>s+con.a[i]**2,0);
        if(norm<1e-20)return null;
        for(const i of active)x[i]=clamp(x[i]-con.g*con.a[i]/norm,lower[i],upper[i]);
      }
      if(violation<=1e-10)return x;
    }
    return constraints(x).every(con=>con.g<=1e-9)?x:null;
  };
  const initial=project(start),trace=[],attempts=[],cache=new Map();let evaluations=0,verifications=0,best=null,exhausted=false;
  const frequencyOf=r=>metric==='lossless'?r.modes[0].f:application==='tune'?r.response?.peak?.f:r.performance?.peak?.f;
  const success=p=>p&&Math.abs(p.relativeError)<=tolerance&&Math.abs(p.qRelativeError)<=qTolerance;
  const evaluate=(x,mesh,phase,final=false)=>{
    if(!x)return null;
    const key=mesh+':'+x.map(v=>v.toPrecision(12)).join(',');
    if(!final&&cache.has(key))return cache.get(key);
    if(evaluations>=maxEvaluations){exhausted=true;return null;}
    const g=decode(x);let result,p;
    try{
      if(!envelopeFits(g,limits))return null;
      evaluations++;result=helmholtzModesFEM({geometry:g,c,level:mesh,nModes:final?6:1});
      const f0=result.modes[0].f;
      result.response=helmholtzFrequencyResponse({result,losses,fStart:.1*f0,fEnd:2*f0,nSamples:final?81:41});
      if(final||metric==='application'&&application!=='tune')result.performance=helmholtzPortPerformance({result,application,faceWidth,ductDiameter,targetFrequency});
      const frequency=frequencyOf(result),qualityFactor=result.response.Q;
      if(!Number.isFinite(frequency)||frequency<=0||!Number.isFinite(qualityFactor)||qualityFactor<=0)throw new Error('Fundamental peak or both half-power Q crossings are unresolved.');
      const relativeError=(frequency-targetFrequency)/targetFrequency,qRelativeError=(qualityFactor-targetQ)/targetQ;
      const r=[Math.log(frequency/targetFrequency),Math.log(qualityFactor/targetQ)];
      const score=(r[0]/Math.log1p(tolerance))**2+(r[1]/Math.log1p(qTolerance))**2;
      p={x:[...x],geometry:g,frequency,qualityFactor,relativeError,qRelativeError,r,score,level:mesh,envelope:resonatorEnvelope(g,limits)};
      if(final){verifications++;p.result=result;}
      if(!best||mesh===level&&best.level!==level||mesh===best.level&&p.score<best.score)best=p;
      cache.set(key,p);
      trace.push({stage:phase,parameter:'multiple',geometry:g,frequency,error:relativeError,qualityFactor,qError:qRelativeError,envelope:p.envelope,score,level:mesh});
    }catch(error){
      cache.set(key,null);attempts.push({parameter:'multiple',status:'failed-trial',message:error.message});
    }
    onProgress?.({stage:'inverse',phase,parameter:'multiple',frequency:p?.frequency??best?.frequency??0,error:p?.relativeError??best?.relativeError??0,
      qualityFactor:p?.qualityFactor??best?.qualityFactor??null,qError:p?.qRelativeError??best?.qRelativeError??null,eigenSolves:evaluations,verifications,evaluations,maxEvaluations});
    return p;
  };
  const norm=x=>Math.sqrt(x.reduce((s,v)=>s+v*v,0));
  function optimize(seed,mesh,budget,phase){
    if(budget<=0)return null;
    const stop=Math.min(maxEvaluations,evaluations+budget);
    let current=evaluate(project(seed),mesh,phase),trust=.35,stalls=0;
    if(!current)return null;
    for(let iteration=0;iteration<18&&evaluations<stop-1&&!success(current);iteration++){
      const dirs=[],df=[],dq=[];
      for(const j of active){
        if(evaluations>=stop-1)break;
        let y=[...current.x];y[j]+=.03;y=project(y);
        if(!y||norm(y.map((v,i)=>v-current.x[i]))<1e-6){y=[...current.x];y[j]-=.03;y=project(y);}
        const trial=evaluate(y,mesh,phase);if(!trial)continue;
        const direction=active.map(i=>trial.x[i]-current.x[i]);if(norm(direction)<1e-6)continue;
        dirs.push(direction);df.push(trial.r[0]-current.r[0]);dq.push(trial.r[1]-current.r[1]);
      }
      const n=active.length,A=Array.from({length:n},()=>new Array(n).fill(0));
      dirs.forEach(d=>{for(let i=0;i<n;i++)for(let j=0;j<n;j++)A[i][j]+=d[i]*d[j];});
      const ridge=Math.max(1e-12,A.reduce((s,row,i)=>s+row[i],0)*1e-7);for(let i=0;i<n;i++)A[i][i]+=ridge;
      const gradient=b=>linearSolve(A,Array.from({length:n},(_,i)=>dirs.reduce((s,d,j)=>s+d[i]*b[j],0)));
      const gf=gradient(df),gq=gradient(dq);let accepted=null;
      if(gf&&gq){
        const ff=gf.reduce((s,v)=>s+v*v,0),qq=gq.reduce((s,v)=>s+v*v,0),fq=gf.reduce((s,v,i)=>s+v*gq[i],0),lambda=1e-5*Math.max(ff+qq,1e-6);
        const den=(ff+lambda)*(qq+lambda)-fq*fq;
        if(den>1e-24){
          const a=((qq+lambda)*current.r[0]-fq*current.r[1])/den,b=((ff+lambda)*current.r[1]-fq*current.r[0])/den;
          let step=gf.map((v,i)=>-v*a-gq[i]*b),length=Math.max(...step.map(Math.abs));if(length>trust)step=step.map(v=>v*trust/length);
          for(const factor of [1,.5,.25,.125]){
            if(evaluations>=stop)break;
            const y=[...current.x];active.forEach((index,j)=>{y[index]+=factor*step[j];});
            const trial=evaluate(project(y),mesh,phase);
            if(trial&&trial.score<current.score*(1-1e-7)){accepted=trial;break;}
          }
        }
      }
      if(!accepted){
        for(const j of active)for(const sign of [-1,1]){
          if(evaluations>=stop)break;
          const y=[...current.x];y[j]+=sign*trust/2;
          const trial=evaluate(project(y),mesh,phase);
          if(trial&&trial.score<current.score&&(!accepted||trial.score<accepted.score))accepted=trial;
        }
      }
      if(accepted){current=accepted;stalls=0;}else{trust*=.5;stalls++;if(stalls>=2||trust<.005)break;}
    }
    return current;
  }
  const common={mode:'frequency-q',targetFrequency,targetQ,metric,application,tolerance,qTolerance,level,c,losses:{...losses},faceWidth,ductDiameter,
    originalGeometry:base,parameter:'multiple',dimensions:[...dimensions],bounds:Object.fromEntries(MULTI_DIMENSIONS.map(k=>[k,[...ranges[k]]])),sizeLimits:limits,
    qDefinition:'Isolated cavity-average pressure half-power bandwidth Q; this is not mounted absorption/TL bandwidth Q.',
    verificationSweep:{startRatio:.1,endRatio:2,nSamples:81}};
  if(!initial)return {...common,status:'infeasible',trace,attempts,eigenSolves:0,verifications:0,evaluations:0,
    note:'No feasible starting geometry was found with these size limits, fixed dimensions and bounds. Relax a limit or unlock more dimensions. Current geometry is unchanged.'};
  const exploratory=level==='coarse'?level:'coarse',explorationBudget=level==='coarse'?maxEvaluations-2:Math.floor(maxEvaluations*.6);
  let candidate=optimize(initial,exploratory,Math.min(42,explorationBudget),'coarse joint search');
  if(!success(candidate)&&evaluations<explorationBudget){
    for(const shift of [[-.4,-.4,-.4,0],[.4,.4,.4,0],[-.6,.6,0,0]]){
      if(evaluations>=explorationBudget-4)break;
      const seed=initial.map((v,i)=>dimensions.includes(MULTI_DIMENSIONS[i])?v+shift[i]:v);
      const alternative=optimize(seed,exploratory,Math.min(22,explorationBudget-evaluations),'coarse restart');
      if(alternative&&(!candidate||alternative.score<candidate.score))candidate=alternative;
      if(success(candidate))break;
    }
  }
  if(level!==exploratory&&candidate)candidate=optimize(candidate.x,level,Math.max(0,maxEvaluations-evaluations-2),'selected-mesh refinement');
  let verified=success(candidate)&&candidate.level===level?evaluate(candidate.x,level,'full joint verification',true):null;
  if(verified&&!success(verified)&&evaluations<maxEvaluations-2){candidate=optimize(verified.x,level,maxEvaluations-evaluations-1,'verification correction');if(success(candidate))verified=evaluate(candidate.x,level,'full joint verification',true);}
  if(success(verified))return {...common,status:'converged',geometry:verified.geometry,frequency:verified.frequency,qualityFactor:verified.qualityFactor,
    relativeError:verified.relativeError,qRelativeError:verified.qRelativeError,envelope:verified.envelope,result:verified.result,
    trace,attempts,eigenSolves:evaluations,verifications,evaluations,maxEvaluations,
    note:'Multiple dimensions varied together; selected losses stayed fixed. Both frequency and isolated bandwidth Q passed fresh FEM verification on the requested mesh, inside the configured envelope. This local bounded search does not prove a global optimum. Check mesh convergence after applying; packaging allowance is a size reserve, not a structural wall model.'};
  const closest=verified||best||candidate;
  return {...common,status:'not-converged',trace,attempts:attempts.slice(-8),eigenSolves:evaluations,verifications,evaluations,maxEvaluations,exhausted:exhausted||evaluations>=maxEvaluations-2,
    best:closest?{geometry:closest.geometry,frequency:closest.frequency,qualityFactor:closest.qualityFactor,relativeError:closest.relativeError,qRelativeError:closest.qRelativeError,envelope:closest.envelope,level:closest.level}:null,
    note:'No jointly verified match was found within the configured search effort and limits. The closest trial is not an accepted design. Adjust the targets, bounds, size limits or adjustable dimensions; current geometry is unchanged.'};
}
