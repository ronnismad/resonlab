/** Application loading of a uniform-pressure FEM mouth port, exp(+i omega t).
 * The interior impedance excludes exterior radiation. Mounted applications add
 * only the selected end MASS; their plane-wave loading supplies radiation.
 */
import { createHelmholtzResponseSolver } from './helmholtz-response.js?v=20261027';

export const APPLICATIONS = {
  tune: { title: 'Tune a resonance', result: 'Isolated pressure response', description: 'Find resonance frequency, pressure gain and bandwidth Q.' },
  absorber: { title: 'Absorb sound', result: 'Normal-incidence absorption', description: 'One resonator per square cell in a rigid-backed panel.' },
  duct: { title: 'Reduce duct noise', result: 'Side-branch transmission loss', description: 'One resonator on a circular duct with anechoic ends, without flow.' },
};

export function normalIncidenceAbsorption({resistance,reactance,cellArea,rho,c}) {
  if (![cellArea,rho,c].every(v=>Number.isFinite(v)&&v>0) || !Number.isFinite(resistance+reactance) || resistance<0) throw new Error('Absorption needs passive impedance, positive cell area and valid medium.');
  const re=resistance*cellArea, im=reactance*cellArea, z0=rho*c, den=(re+z0)**2+im**2;
  return {alpha:4*re*z0/den, reflectionRe:(re*re+im*im-z0*z0)/den, reflectionIm:2*z0*im/den, surfaceResistance:re,surfaceReactance:im};
}

export function sideBranchTransmission({resistance,reactance,ductArea,rho,c}) {
  if (![ductArea,rho,c].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(resistance+reactance)||resistance<0) throw new Error('Duct loading needs passive impedance, positive duct area and valid medium.');
  const zc=rho*c/ductArea, den=(2*resistance+zc)**2+4*reactance**2;
  const transmission=4*(resistance**2+reactance**2)/den, reflection=zc**2/den, dissipation=4*resistance*zc/den;
  return {transmission,reflection,dissipation,TLdB:transmission===0?Infinity:-10*Math.log10(transmission)};
}

export function helmholtzPortPerformance({result,application='tune',faceWidth=.16,ductDiameter=.15,targetFrequency=150,onProgress}={}) {
  if (!APPLICATIONS[application]) throw new Error('Choose tuning, absorption or duct noise reduction.');
  if (!result.response) throw new Error('Solve a valid driven FEM response first.');
  const {geometry:g,c}=result, losses=result.response.losses, {rho}=losses;
  const validLength=v=>Number.isFinite(v)&&v>0&&v<=100;
  if (application==='absorber'&&!validLength(faceWidth)||application==='duct'&&!validLength(ductDiameter)) throw new Error('The selected mounting dimension must be between 0 and 100 m.');
  if (!Number.isFinite(targetFrequency)||targetFrequency<=0) throw new Error('Target frequency must be positive and finite.');
  if (application==='absorber'&&faceWidth<2*g.radius) throw new Error(`Panel cells overlap: cell width must be at least ${(2000*g.radius).toFixed(1)} mm for this cavity.`);
  if (application==='duct'&&ductDiameter<=2*g.neckRadius) throw new Error('Main duct diameter must exceed the resonator neck diameter.');
  const solver=createHelmholtzResponseSolver(result,losses), points=new Map();
  const at=f=>{
    if (!points.has(f)) {
      const p=solver.solve(f,{port:true});
      // Roundoff-only negative real parts may occur in a lossless port.
      const resistance=Math.max(0,p.resistance), reactance=p.reactance+p.endMassReactance;
      const mounted=application==='absorber'?normalIncidenceAbsorption({resistance,reactance,cellArea:faceWidth**2,rho,c})
        :application==='duct'?sideBranchTransmission({resistance,reactance,ductArea:Math.PI*ductDiameter**2/4,rho,c}):{};
      points.set(f,{...p,resistance,mountedReactance:reactance,...mounted});
      onProgress?.({stage:'port',iteration:points.size});
    }
    return points.get(f);
  };
  result.response.freqs.forEach(at);
  const range=result.response.freqs;
  const target=targetFrequency>=range[0]&&targetFrequency<=range.at(-1)?at(targetFrequency):null;
  const key=application==='absorber'?'alpha':application==='duct'?'TLdB':null;
  let peak=null;
  if (key) {
    const grid=[...points.values()].sort((a,b)=>a.f-b.f), best=grid.reduce((i,p,j)=>p[key]>grid[i][key]?j:i,0);
    if (best>0&&best<grid.length-1) {
      let lo=grid[best-1].f,hi=grid[best+1].f;
      for(let j=0;j<28;j++){const a=lo+(hi-lo)*.38196601125,b=hi-(hi-lo)*.38196601125;if(at(a)[key]<at(b)[key])lo=a;else hi=b;}
      peak=at((lo+hi)/2);
    }
  }
  const rows=[...points.values()].sort((a,b)=>a.f-b.f),warnings=[];
  const maxFrequency=rows.at(-1).f;
  const ductCutoff=validLength(ductDiameter)?1.841183781*c/(Math.PI*ductDiameter):null;
  if(application==='duct'&&maxFrequency>=ductCutoff)warnings.push(`Sweep reaches the first transverse duct cutoff (${ductCutoff.toFixed(1)} Hz); the plane-wave shunt model is no longer reliable.`);
  if(application==='absorber'&&maxFrequency*faceWidth/c>=.25)warnings.push('Panel pitch exceeds one quarter wavelength in this sweep; the locally reacting homogenized panel approximation needs review.');
  if(key&&!peak)warnings.push('The best mounted performance is at a sweep edge. Widen the sweep before treating it as a peak.');
  if(!target)warnings.push('Target frequency is outside the solved sweep. Adjust the sweep range to evaluate it.');
  return {application,faceWidth:validLength(faceWidth)?faceWidth:null,ductDiameter:validLength(ductDiameter)?ductDiameter:null,targetFrequency,target,rows,peak,ductCutoff,warnings,geometry:g,medium:{rho,c,mu:losses.mu,gamma:losses.gamma,Pr:losses.Pr},
    maxResidual:Math.max(...rows.map(p=>p.residual)),
    port:'Uniform 1 Pa mouth pressure; inward volume velocity from FEM weak-form reactions. Interior impedance in Pa s/m^3.',
    loading:application==='tune'?'Interior mouth impedance; exterior end mass and radiation resistance excluded.'
      :'Interior FEM impedance plus selected end mass. Free-air radiation resistance excluded; panel or duct plane-wave loading supplies the external coupling.',
    assumptions:application==='absorber'?'Rigid-backed panel, identical non-overlapping square cells, normal incidence, locally reacting surface; mutual aperture coupling neglected. Selected isolated-mouth end mass is an approximation to the mounted junction.'
      :application==='duct'?'Single compact shunt branch, equal circular ducts, anechoic inlet/outlet, plane waves and zero mean flow. Selected isolated-mouth end mass approximates the duct junction.'
      :'One cylindrical cavity and coaxial circular neck; axisymmetric pressure-acoustics FEM with selected thin wall layers.'};
}
