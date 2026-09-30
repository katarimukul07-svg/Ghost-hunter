// Coordinates are pointer targets, never positions/velocity/score assignments.
export const exactKeys=(value,names)=>value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).sort().join(',')===[...names].sort().join(',');
export const PROFILES=Object.freeze({phone:{width:393,height:727},desktop:{width:1280,height:646}});
export function validateInputs(inputs,profile){
 const size=PROFILES[profile];if(!size||!Array.isArray(inputs)||inputs.length<1||inputs.length>18000)throw Error('Invalid input');
 let paused=false,steps=0,pauses=0;
 for(let i=0;i<inputs.length;i++){
  const p=inputs[i];
  if(!exactKeys(p,['tick','x','y','action'])||p.tick!==i+1||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>size.width||p.y>size.height||!['step','pause','resume'].includes(p.action))throw Error('Invalid input');
  if(p.action==='pause'){if(paused||++pauses>30)throw Error('Invalid lifecycle');paused=true;}
  if(p.action==='resume'){if(!paused)throw Error('Invalid lifecycle');paused=false;}
  if(p.action==='step'){if(paused)throw Error('Input while paused');steps++;}
 }
 if(!steps)throw Error('No simulation');return {steps,simulatedMs:Math.ceil(steps*1000/60)};
}
