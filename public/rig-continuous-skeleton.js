import {Bone,Skeleton,SkinnedMesh,BufferGeometry,Float32BufferAttribute,Uint16BufferAttribute,MeshBasicMaterial,Vector3} from './vendor/three/three.core.js';

const base={...AnimalRig},cache=new WeakMap();
const meshes=await (await fetch('/animals/skeleton-meshes.json',{cache:'no-store'})).json();
const signedArea=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(r.x-p.x)*(q.y-p.y);
function preserveTriangles(mesh,target,data){
  if(!mesh.areaConstraints){
    const feet=new Set(data.chains.map(c=>c.indices.at(-1)));
    const mobility=data.skin.map((s,i)=>{
      const v=mesh.vertices[i];
      if(v.head>.01||v.tail>.01||v.extra>.01||v.eyes.some(w=>w>.01))return 1;
      return s.indices.some((b,j)=>(b===0||feet.has(b))&&s.weights[j]>.995)?0:1;
    });
    mesh.areaConstraints={mobility,triangles:mesh.triangles.map(([a,b,c])=>{
      const area=signedArea(mesh.vertices[a],mesh.vertices[b],mesh.vertices[c]);return {a,b,c,sign:Math.sign(area),minimum:Math.abs(area)*.06};
    })};
  }
  const {mobility,triangles}=mesh.areaConstraints;
  for(let iteration=0;iteration<32;iteration++){
    let violations=0;
    for(const {a,b,c,sign,minimum} of triangles){
      const p=target[a],q=target[b],r=target[c],area=signedArea(p,q,r)*sign;
      if(area>=minimum)continue;violations++;
      const gx=[q.y-r.y,r.y-p.y,p.y-q.y],gy=[r.x-q.x,p.x-r.x,q.x-p.x],ids=[a,b,c];
      const denominator=ids.reduce((sum,id,i)=>sum+mobility[id]*(gx[i]**2+gy[i]**2),0);
      if(denominator<1e-8)continue;
      const correction=(minimum-area)/denominator;
      ids.forEach((id,i)=>{target[id].x+=correction*mobility[id]*gx[i]*sign;target[id].y+=correction*mobility[id]*gy[i]*sign;});
    }
    if(!violations)break;
  }
}
function build(mesh) {
  const geometryData=meshes[mesh.rig.species],root=new Bone(),bones=[root],chains=[];
  const pivots=[[0,0]];
  for(const definition of geometryData.chains) {
    const nodes=[],angles=[],lengths=[];let parent=root,previousAngle=0;
    definition.points.forEach((point,i)=>{
      const bone=new Bone();parent.add(bone);
      if(i===0)bone.position.set(...point,0);
      else bone.position.x=lengths[i-1];
      const next=definition.points[i+1];
      const angle=next?Math.atan2(next[1]-point[1],next[0]-point[0]):0;
      if(next)lengths.push(Math.hypot(next[0]-point[0],next[1]-point[1]));
      bone.rotation.z=angle-previousAngle;angles.push(angle);previousAngle=angle;
      bones.push(bone);pivots.push(point);nodes.push(bone);parent=bone;
    });
    chains.push({...definition,nodes,angles,lengths});
  }
  const positions=[],indices=[],weights=[];
  mesh.vertices.forEach((v,index)=>{
    positions.push(v.x+mesh.rig.x,v.y+mesh.rig.y,0);
    indices.push(...geometryData.skin[index].indices);weights.push(...geometryData.skin[index].weights);
  });
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  const skinned=new SkinnedMesh(geometry,new MeshBasicMaterial());skinned.add(root);
  skinned.updateMatrixWorld(true);skinned.bind(new Skeleton(bones));
  const result={skinned,root,chains,pivots,point:new Vector3()};cache.set(mesh,result);return result;
}
AnimalRig.create=(rig)=>{
  const geometry=meshes[rig.species];
  const mesh=base.create(rig,18,20,geometry.vertices.map(([x,y])=>[x-rig.x,y-rig.y]));
  const owners=new Map([[0,-1]]);geometry.chains.forEach((chain,i)=>chain.indices.forEach(bone=>owners.set(bone,i)));
  const depth=triangle=>{
    const totals=new Map();
    for(const vertex of triangle){const skin=geometry.skin[vertex];skin.indices.forEach((bone,i)=>{const owner=owners.get(bone);totals.set(owner,(totals.get(owner)||0)+skin.weights[i]);});}
    const owner=[...totals].sort((a,b)=>b[1]-a[1])[0][0];
    return owner<0?1:owner%2===1?0:2+owner;
  };
  mesh.triangles=geometry.triangles.slice().sort((a,b)=>depth(a)-depth(b));return mesh;
};
function solveHind(chain,pose,gait,bodyY) {
  const hip={x:chain.points[0][0],y:chain.points[0][1]+bodyY};
  const ankle=pose.ankle;
  // A controlled metatarsal pitch removes the ambiguity of a free three-bone
  // chain. Solve the thigh/shin against the hock target, with a forward knee.
  const pitch=Math.PI/2+.13+.08*Math.sin(gait*Math.PI*2);
  const scale=chain.retarget?pose.lengthScale:1,length=chain.lengths[2]*scale;
  const hock={x:ankle.x-Math.cos(pitch)*length,y:ankle.y-Math.sin(pitch)*length};
  const a=chain.lengths[0]*scale,b=chain.lengths[1]*scale;
  const dx=hock.x-hip.x,dy=hock.y-hip.y,distance=Math.hypot(dx,dy);
  const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
  const knee={x:hip.x+dx/distance*along+dy/distance*height,y:hip.y+dy/distance*along-dx/distance*height};
  return {points:[hip,knee,hock,ankle],scale};
}
AnimalRig.draw=(ctx,texture,rig,mesh,gait,movement,time=0,phase=0,blinkOverride,groundBaseline)=>{
  const blink=blinkOverride??base.blinkAt(time,phase,rig.species),gpu=base.supportsWebGL();
  mesh.textureBlink=gpu?blink:0;
  const source=base.deform(mesh,gait,0,time,phase,gpu?0:blink);
  if(!movement){base.drawMesh(ctx,texture,mesh,source);return;}
  const state=cache.get(mesh)||build(mesh);
  const {poses,bodyY}=base.poseFromSoles(rig,mesh,gait,movement,groundBaseline,meshes[rig.species].soles);
  state.root.position.y=bodyY;
  const solutions=state.chains.map((chain,i)=>{
    const pose=poses[i];
    const solution=chain.points.length===4?solveHind(chain,pose,gait+mesh.profile.phases[i],bodyY):{points:[pose.hip,pose.knee,pose.ankle],scale:pose.lengthScale};
    chain.nodes[0].scale.setScalar(solution.scale);
    let previousAngle=0;
    chain.nodes.forEach((node,j)=>{
      const p=solution.points[j],next=solution.points[j+1];
      const angle=next?Math.atan2(next.y-p.y,next.x-p.x):Math.atan2(pose.foot[1],pose.foot[0]);
      node.rotation.z=angle-previousAngle;previousAngle=angle;
    });
    chain.nodes.at(-1).scale.setScalar(1/solution.scale);
    return solution;
  });
  state.skinned.updateMatrixWorld(true);state.skinned.skeleton.update();
  let jointError=0;
  state.chains.forEach((chain,i)=>chain.nodes.forEach((bone,j)=>{
    bone.getWorldPosition(state.point);const expected=solutions[i].points[j];
    jointError=Math.max(jointError,Math.hypot(state.point.x-expected.x,state.point.y-expected.y));
  }));
  // Planar dual-quaternion blending preserves joint volume during rotations.
  // Apply calibrated uniform limb scale about each joint before rigid blending.
  const palette=state.skinned.skeleton.boneMatrices;
  const transforms=Array.from({length:palette.length/16},(_,bone)=>{
    const offset=bone*16,scale=Math.hypot(palette[offset],palette[offset+1]);
    const angle=Math.atan2(palette[offset+1],palette[offset]),c=Math.cos(angle/2),s=Math.sin(angle/2);
    const [px,py]=state.pivots[bone],cosine=c*c-s*s,sine=2*c*s;
    const x=palette[offset+12]+(scale-1)*(cosine*px-sine*py),y=palette[offset+13]+(scale-1)*(sine*px+cosine*py);
    return {c,s,scale,px,py,dx:(x*c+y*s)/2,dy:(-x*s+y*c)/2};
  });
  const target=source.map((p,i)=>{
    const skin=meshes[rig.species].skin[i],reference=transforms[skin.indices[0]];
    let c=0,s=0,dx=0,dy=0,x=p.x+rig.x,y=p.y+rig.y,sx=0,sy=0;
    skin.indices.forEach((bone,j)=>{
      const t=transforms[bone],w=skin.weights[j],sign=t.c*reference.c+t.s*reference.s<0?-1:1;
      c+=t.c*w*sign;s+=t.s*w*sign;dx+=t.dx*w*sign;dy+=t.dy*w*sign;
      sx+=(t.scale-1)*(x-t.px)*w;sy+=(t.scale-1)*(y-t.py)*w;
    });
    const norm=Math.hypot(c,s);c/=norm;s/=norm;dx/=norm;dy/=norm;
    const cosine=c*c-s*s,sine=2*c*s;x+=sx;y+=sy;
    return {x:cosine*x-sine*y+2*(dx*c-dy*s)-rig.x,y:sine*x+cosine*y+2*(dx*s+dy*c)-rig.y};
  });
  preserveTriangles(mesh,target,meshes[rig.species]);
  let folds=0;
  for(const [a,b,c] of mesh.triangles)if(signedArea(mesh.vertices[a],mesh.vertices[b],mesh.vertices[c])*signedArea(target[a],target[b],target[c])<=0)folds++;
  mesh.skeletonQuality={folds,jointError};
  base.drawMesh(ctx,texture,mesh,target);
};
document.documentElement.dataset.skeletonRuntime='three.js continuous skin';
