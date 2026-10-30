import { helmholtzModesFEM } from './helmholtz-fem.js?v=20261027';
import { helmholtzFrequencyResponse } from './helmholtz-response.js?v=20261027';
import { helmholtzPortPerformance } from './acoustic-performance.js?v=20261031';
import { inverseDesignHelmholtzFEM } from './fem-inverse-design.js?v=20261031';
self.onmessage = ({ data }) => {
  try {
    if(data.operation==='inverse'){
      const result=inverseDesignHelmholtzFEM({...data,onProgress:p=>self.postMessage({type:'progress',...p})});
      self.postMessage({type:'result',result});return;
    }
    const result = helmholtzModesFEM({ ...data, onProgress: (progress) => {
      if (progress.iteration % 5 === 0) self.postMessage({ type: 'progress', ...progress });
    } });
    if (data.response) {
      try { result.response = helmholtzFrequencyResponse({ result, ...data.response,
        fStart: result.modes[0].f * data.response.startRatio,
        fEnd: result.modes[0].f * data.response.endRatio,
        onProgress: (progress) => { if (progress.iteration % 10 === 0) self.postMessage({ type: 'progress', ...progress }); } }); }
      catch (error) { result.responseError = error.message; }
    }
    if (data.performance && result.response) {
      try { result.performance=helmholtzPortPerformance({result,...data.performance,onProgress:p=>{
        if(p.iteration%10===0)self.postMessage({type:'progress',...p});
      }}); } catch(error) { result.performanceError=error.message; }
    }
    self.postMessage({ type: 'result', result });
  } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
};
