/** Driven axisymmetric FEM, exp(+i wt). Thin, stationary isothermal wall layers.
 * D = K -(1-i)dv/2 Sv - k²[M +(1-i)(gamma-1)dt/2 St] + Y B.
 * Y=i k/(R+i k delta), Z/(rho c)=R+i k delta. The static mouth
 * stiffness in K is replaced, never added twice. Source velocity = p_drive/Z.
 */
import { assembleHelmholtz, bandMultiply } from './helmholtz-fem.js?v=20261027';

const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
function edgeMatrices(mesh, system) {
  const {K,dof}=system, make=()=>({...K,data:new Float64Array(K.data.length)});
  const B=make(), T=make(), S=make();
  const add=(A,i,j,v)=>{i=dof[i];j=dof[j];if(i<0||j<0)return;if(i<j)[i,j]=[j,i];A.data[i*(K.bandwidth+1)+i-j]+=v;};
  const edge=(ids,A,gradient=false)=>{
    const [i,j]=ids,[r0,z0]=mesh.nodes[i],[r1,z1]=mesh.nodes[j],l=Math.hypot(r1-r0,z1-z0);
    if(gradient){const v=Math.PI*(r0+r1)/l;add(A,i,i,v);add(A,j,j,v);add(A,i,j,-v);}
    else {const v=2*Math.PI*l;add(A,i,i,v*(3*r0+r1)/12);add(A,j,j,v*(r0+3*r1)/12);add(A,i,j,v*(r0+r1)/12);}
  };
  mesh.mouthEdges.forEach(e=>edge(e,B));
  mesh.boundaries.rigid.forEach(e=>{edge(e,T);edge(e,S,true);});
  // Exact cavity volume integral of each P1 basis, including junction nodes.
  const weights=new Float64Array(K.n);
  for(const tri of mesh.triangles){
    const p=tri.map(i=>mesh.nodes[i]);if(p.some(v=>v[1]>mesh.geometry.height+1e-12))continue;
    const area=Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[2][0]-p[0][0])*(p[1][1]-p[0][1]))/2;
    const sum=p.reduce((s,v)=>s+v[0],0);
    tri.forEach((node,i)=>{if(dof[node]>=0)weights[dof[node]]+=2*Math.PI*area*(sum+p[i][0])/12/mesh.geometry.volume;});
  }
  return {B,T,S,weights};
}

/** Complex symmetric band LDLᵀ (no conjugation); residual checked after solve. */
export function solveComplexBand(A,re,im,br,bi) {
  const {n,bandwidth:b}=A,s=b+1,lr=re.slice(),li=im.slice();
  for(let i=0;i<n;i++)for(let j=Math.max(0,i-b);j<=i;j++){
    const ij=i*s+i-j;let ar=lr[ij],ai=li[ij];
    for(let k=Math.max(0,i-b,j-b);k<j;k++){
      const ik=i*s+i-k,jk=j*s+j-k,kk=k*s;
      const pr=lr[ik]*lr[jk]-li[ik]*li[jk],pi=lr[ik]*li[jk]+li[ik]*lr[jk];
      ar-=pr*lr[kk]-pi*li[kk];ai-=pr*li[kk]+pi*lr[kk];
    }
    if(i===j){if(!Number.isFinite(ar+ai)||Math.hypot(ar,ai)<1e-28)throw new Error('Singular driven FEM system. Enable damping or avoid an exact lossless resonance.');lr[ij]=ar;li[ij]=ai;}
    else {const d=j*s,den=lr[d]**2+li[d]**2;lr[ij]=(ar*lr[d]+ai*li[d])/den;li[ij]=(ai*lr[d]-ar*li[d])/den;}
  }
  const xr=Float64Array.from(br),xi=Float64Array.from(bi);
  for(let i=0;i<n;i++)for(let j=Math.max(0,i-b);j<i;j++){const q=i*s+i-j;xr[i]-=lr[q]*xr[j]-li[q]*xi[j];xi[i]-=lr[q]*xi[j]+li[q]*xr[j];}
  for(let i=0;i<n;i++){const d=i*s,den=lr[d]**2+li[d]**2,r=xr[i],v=xi[i];xr[i]=(r*lr[d]+v*li[d])/den;xi[i]=(v*lr[d]-r*li[d])/den;}
  for(let i=n-1;i>=0;i--)for(let j=i+1;j<=Math.min(n-1,i+b);j++){const q=j*s+j-i;xr[i]-=lr[q]*xr[j]-li[q]*xi[j];xi[i]-=lr[q]*xi[j]+li[q]*xr[j];}
  const R={...A,data:re},I={...A,data:im},rr=bandMultiply(R,xr),ii=bandMultiply(I,xi),ri=bandMultiply(R,xi),ir=bandMultiply(I,xr);
  let err=0,norm=0;for(let i=0;i<n;i++){err+=(rr[i]-ii[i]-br[i])**2+(ri[i]+ir[i]-bi[i])**2;norm+=br[i]**2+bi[i]**2;}
  const residual=Math.sqrt(err/Math.max(norm,1e-300));
  if(!Number.isFinite(residual)||residual>1e-6)throw new Error('Driven FEM linear solve failed its residual check. Try a different mesh or more damping.');
  return {re:xr,im:xi,residual};
}

export function createHelmholtzResponseSolver(result,{rho=1.2,mu=1.81e-5,gamma=1.4,Pr=.71,radiation=true,viscous=true,thermal=true,extraLoss=0}={}){
  if(![rho,mu,Pr].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(gamma)||gamma<=1||!Number.isFinite(extraLoss)||extraLoss<0||extraLoss>1)throw new Error('Invalid fluid properties or additional loss factor (0–1).');
  const {mesh,c}=result,g=mesh.geometry;
  if(!(g.mouthDelta>0))throw new Error('Choose a flanged or unflanged mouth end correction for the driven radiation study.');
  const system=assembleHelmholtz(mesh),{K,M}=system,{B,T,S,weights}=edgeMatrices(mesh,system);
  const mouth=bandMultiply(B,new Float64Array(K.n).fill(1));
  const options={rho,mu,gamma,Pr,radiation,viscous,thermal,extraLoss};
  return {options,solve(f, {port = false} = {}){
    if(!Number.isFinite(f)||f<=0)throw new Error('Response frequencies must be finite and positive.');
    const w=2*Math.PI*f,k=w/c,ka=k*g.neckRadius,dv=viscous?Math.sqrt(2*mu/(rho*w)):0,dt=thermal?Math.sqrt(2*mu/(rho*w*Pr)):0;
    const R=radiation?(g.endCorrectionModel==='flanged'?.5:.25)*ka*ka:0,X=k*g.mouthDelta,den=R*R+X*X,yr=k*X/den,yi=k*R/den;
    const re=new Float64Array(K.data.length),im=new Float64Array(re.length);
    for(let j=0;j<re.length;j++){
      const v=dv/2*S.data[j],t=k*k*(gamma-1)*dt/2*T.data[j];
      re[j]=K.data[j]-B.data[j]/g.mouthDelta-k*k*M.data[j]-v-t+(port?0:yr*B.data[j]);
      im[j]=v+t+extraLoss*k*k*M.data[j]+(port?0:yi*B.data[j]);
    }
    if (port) {
      // Uniform 1 Pa pressure at the real mouth. Recover inward volume flow
      // from the ORIGINAL weak-form reactions, including wall-layer terms.
      const originalRe = re.slice(), originalIm = im.slice();
      const fixed = new Set(mesh.mouthNodes.map(i => system.dof[i]));
      const br = new Float64Array(K.n), bi = new Float64Array(K.n), stride = K.bandwidth + 1;
      for (let i = 0; i < K.n; i++) for (let j = Math.max(0, i-K.bandwidth); j <= i; j++) {
        const q = i*stride+i-j;
        if (i === j && fixed.has(i)) { re[q]=1; im[q]=0; br[i]=1; }
        else if (i !== j && (fixed.has(i) || fixed.has(j))) {
          if (!fixed.has(i)) { br[i]-=re[q]; bi[i]-=im[q]; }
          if (!fixed.has(j)) { br[j]-=re[q]; bi[j]-=im[q]; }
          re[q]=im[q]=0;
        }
      }
      const p = solveComplexBand(K,re,im,br,bi);
      const rr=bandMultiply({...K,data:originalRe},p.re), ii=bandMultiply({...K,data:originalIm},p.im);
      const ri=bandMultiply({...K,data:originalRe},p.im), ir=bandMultiply({...K,data:originalIm},p.re);
      let reactionRe=0,reactionIm=0;
      for (const i of fixed) { reactionRe+=rr[i]-ii[i]; reactionIm+=ri[i]+ir[i]; }
      const flowRe=reactionIm/(rho*w), flowIm=-reactionRe/(rho*w), flow2=flowRe**2+flowIm**2;
      if (!(flow2 > 1e-280)) throw new Error('Mouth port flow is too small to resolve impedance.');
      const resistance=flowRe/flow2, reactance=-flowIm/flow2;
      if (!Number.isFinite(resistance+reactance) || resistance < -1e-7*Math.hypot(resistance,reactance)) throw new Error('Mouth port failed the passive impedance check.');
      return { f, resistance, reactance, flowRe, flowIm, residual:p.residual,
        endMassReactance:w*rho*g.mouthDelta/(Math.PI*g.neckRadius**2) };
    }
    const p=solveComplexBand(K,re,im,mouth.map(v=>yr*v),mouth.map(v=>yi*v));
    const hr=dot(weights,p.re),hi=dot(weights,p.im),mag=Math.hypot(hr,hi);
    const energy=A=>dot(p.re,bandMultiply(A,p.re))+dot(p.im,bandMultiply(A,p.im));
    const power={radiation:yi*energy(B)/(2*rho*w),viscous:dv/2*energy(S)/(2*rho*w),thermal:k*k*(gamma-1)*dt/2*energy(T)/(2*rho*w),additional:extraLoss*k*k*energy(M)/(2*rho*w)};
    const injectedPower=(yi*dot(mouth,p.re)-yr*dot(mouth,p.im))/(2*rho*w);
    return {f,re:hr,im:hi,mag,magDb:20*Math.log10(Math.max(mag,1e-300)),phase:Math.atan2(hi,hr),residual:p.residual,power,injectedPower,ka,deltaV:dv,deltaT:dt,fieldRe:system.dof.map(d=>d<0?0:p.re[d]),fieldIm:system.dof.map(d=>d<0?0:p.im[d])};
  }};
}

export function helmholtzFrequencyResponse({result,losses={},fStart,fEnd,nSamples=101,onProgress}={}){
  const f0=result.modes[0].f;fStart??=.5*f0;fEnd??=1.5*f0;
  if(!Number.isFinite(fStart)||!Number.isFinite(fEnd)||fStart<=0||fEnd<=fStart||!Number.isInteger(nSamples)||nSamples<21||nSamples>501)throw new Error('Choose a positive increasing frequency range and 21–501 samples.');
  const solver=createHelmholtzResponseSolver(result,losses),cache=new Map();let solves=0;
  if(!solver.options.radiation&&!solver.options.viscous&&!solver.options.thermal&&solver.options.extraLoss===0)throw new Error('All losses are disabled: ideal resonance is singular and has no finite bandwidth Q. Enable at least one loss mechanism to sweep through resonance.');
  const at=f=>{if(!cache.has(f)){cache.set(f,solver.solve(f));onProgress?.({stage:'response',iteration:++solves});}return cache.get(f);};
  const samples=Array.from({length:nSamples},(_,i)=>at(fStart+(fEnd-fStart)*i/(nSamples-1)));
  // Track the fundamental, not an unrelated higher mode in a wide sweep.
  const candidates=samples.map((p,i)=>({p,i})).filter(({p,i})=>i>0&&i<samples.length-1&&p.f>=.6*f0&&p.f<=1.3*f0&&p.mag>samples[i-1].mag&&p.mag>samples[i+1].mag).sort((a,b)=>Math.abs(a.p.f-f0)-Math.abs(b.p.f-f0));
  let peak=null,Q=null,fLower=null,fUpper=null;
  const dissipative=solver.options.radiation||solver.options.viscous||solver.options.thermal||solver.options.extraLoss>0;
  if(candidates.length&&dissipative){
    const i=candidates[0].i;let lo=samples[i-1].f,hi=samples[i+1].f;
    for(let j=0;j<34;j++){const a=lo+(hi-lo)*.38196601125,b=hi-(hi-lo)*.38196601125;if(at(a).mag<at(b).mag)lo=a;else hi=b;}
    peak=at((lo+hi)/2);const target=peak.mag/Math.sqrt(2);
    const crossing=(a,b)=>{for(let j=0;j<36;j++){const mid=(a+b)/2;if((at(a).mag-target)*(at(mid).mag-target)<=0)b=mid;else a=mid;}return(a+b)/2;};
    const lower=samples.filter(p=>p.f<peak.f&&p.mag<=target).at(-1),upper=samples.find(p=>p.f>peak.f&&p.mag<=target);
    if(lower)fLower=crossing(lower.f,peak.f);if(upper)fUpper=crossing(peak.f,upper.f);
    if(fLower!==null&&fUpper!==null)Q=peak.f/(fUpper-fLower);
    samples.push(peak);if(fLower!==null)samples.push(at(fLower));if(fUpper!==null)samples.push(at(fUpper));samples.sort((a,b)=>a.f-b.f);
  }
  const warnings=[];
  if(2*Math.PI*fEnd/result.c*result.geometry.neckRadius>=.5)warnings.push('The mouth radiation approximation requires ka ≪ 1; part of this sweep has ka ≥ 0.5.');
  const low=at(fStart);if(Math.max(low.deltaV,low.deltaT)/result.geometry.neckRadius>.1)warnings.push('Boundary layers exceed 10% of neck radius: use a full thermoviscous model for reliable predictions.');
  if(Q===null)warnings.push('Fundamental half-power Q is unresolved. Enable losses and choose a range containing the peak and both −3 dB crossings.');
  return {freqs:samples.map(p=>p.f),mag:samples.map(p=>p.mag),magDb:samples.map(p=>p.magDb),phase:samples.map(p=>p.phase),real:samples.map(p=>p.re),imag:samples.map(p=>p.im),peak,Q,fLower,fUpper,bandwidth:Q===null?null:fUpper-fLower,losses:solver.options,warnings,maxResidual:Math.max(...samples.map(p=>p.residual)),nSolves:solves,
    source:{amplitudePa:1,type:'Equivalent mouth pressure source',inwardSourceVelocity:'p_drive / Zmouth',boundary:'dn(p) + i*omega*rho/Zmouth*p = i*omega*rho/Zmouth*p_drive',timeConvention:'exp(+i omega t)',receiver:'Physical cavity volume-average pressure; neck excluded'},
    note:'Gain is cavity-average pressure per 1 Pa equivalent mouth drive. Q is peak frequency divided by half-power bandwidth; it is not a complex-pole Q. Powers show passive radiation, wall and bulk dissipation at the peak. Radiation uses a low-frequency approximation and wall losses assume thin boundary layers. Mean flow, nonlinear jet losses and flexible walls are excluded.'};
}
