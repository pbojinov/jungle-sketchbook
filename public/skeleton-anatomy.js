(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./rig-v2'):root.AnimalRig);if(typeof module==='object'&&module.exports)module.exports=api;else root.SafariSkeletonAnatomy=api;})(globalThis,function(rig){
  // The bent, rearward joint in these drawings is the hock. The stifle is
  // higher, under the pelvis, and bends forward independently of the hock.
  const stifles={giraffe:[[314,686],[385,710]],lion:[[281,716],[400,715]],tiger:[[281,674],[371,704]],zebra:[[320,645],[386,665]]};
  function chains(species){let offset=1;return rig.joints[species].map((j,i)=>{
    const points=[[j[0],j[1]],...(stifles[species]?.[i]?[stifles[species][i]]:[]),[j[2],j[3]],[j[4],j[5]]];
    const indices=points.map(()=>offset++);return {points,indices,radius:j[6],far:i%2===1,retarget:species==='zebra'};
  });}
  return {chains};
});
