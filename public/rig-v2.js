(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./motion') : root.SafariMotion);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AnimalRig = api;
})(globalThis, function(motion) {
  // Anatomy is calibrated in original coloring-sheet coordinates. Every motion
  // warps the same continuous texture, including a child's colors and ink.
  // Head/tail/extra regions: [centerX, centerY, radiusX, radiusY, pivotX, pivotY].
  // Eye regions: [centerX, centerY, radiusX, radiusY]. Angles are in radians.
  const STRIDE = 48;
  const profiles = {
    elephant: { stride: 76, lift: 15, stance: .78, crouch: 8, skinFalloff: 0.36, phases: [0,.5,.75], bob: 1,
      head: [468,445,250,220,455,570], nod: .022, headBob: 3, headRate: 1, headSway: .025, headSwayRate: .52,
      tail: [174,606,90,80,244,579], tailAngle: .115, tailRate: .85,
      extra: [629,567,125,74,529,511], extraAngle: .055,
      eyes: [[435,451,15,23],[566,433,13,21]], blinkPeriod: 5.7 },
    giraffe: { stride: 126, lift: 34, stance: .72, crouch: 12, skinFalloff: 0.24, phases: [0,.5,.75], bob: 3,
      head: [566,337,200,230,429,631], nod: .025, headBob: 4, headRate: .5, headSway: .020, headSwayRate: .43,
      tail: [172,628,88,70,251,592], tailAngle: .145, tailRate: 1.05, tailBodyEdge: [225,260],
      eyes: [[549,350,15,23],[656,319,12,20]], blinkPeriod: 6.2 },
    lion: { stride: 94, lift: 26, stance: .74, crouch: 12, skinFalloff: 0.28, phases: [0,.5,.75], bob: 3,
      head: [508,450,235,249,449,627], nod: .035, headBob: 4, headRate: 1, headSway: .028, headSwayRate: .54,
      tail: [154,502,90,128,244,604], tailAngle: .14, tailRate: .9,
      eyes: [[491,431,15,22],[608,412,13,21]], blinkPeriod: 5.1 },
    monkey: { stride: 86, lift: 30, stance: .72, crouch: 8, skinFalloff: 0.28, phases: [0,.5,.75], bob: 4,
      head: [517,432,213,174,488,572], nod: .055, headBob: 6, headRate: 1, headSway: .038, headSwayRate: .70,
      tail: [194,505,112,159,294,626], tailAngle: .12, tailRate: 1.15,
      eyes: [[496,451,15,22],[610,429,15,22]], blinkPeriod: 4.3 },
    tiger: { stride: 98, lift: 27, stance: .74, crouch: 12, skinFalloff: 0.28, phases: [0,.5,.75], bob: 2,
      head: [536,429,208,192,456,594], nod: .026, headBob: 2, headRate: .5, headSway: .025, headSwayRate: .48,
      tail: [174,416,88,131,276,519], tailAngle: .135, tailRate: .8,
      eyes: [[508,414,16,24],[631,399,13,22]], blinkPeriod: 6.5 },
    zebra: { stride: 116, lift: 34, stance: .72, crouch: 12, skinFalloff: 0.28, phases: [0,.5,.75,.25], bob: 3,
      head: [593,387,165,180,466,568], nod: .04, headBob: 5, headRate: 1, headSway: .027, headSwayRate: .58,
      tail: [168,595,100,62,278,581], tailAngle: .15, tailRate: 1.25, tailFloor: 640,
      eyes: [[575,410,16,23],[683,397,11,20]], blinkPeriod: 4.9 },
  };
  // [hipX, hipY, knee/hockX, knee/hockY, footX, footY, skinRadius].
  // The source drawings already contain bent limbs; those are the bind pose.
  const joints = {
    elephant: [[263,629,236,711,185,739,58],[350,638,348,725,346,759,46],[445,626,482,710,493,753,58]],
    giraffe: [[308,616,259,732,184,857,42],[371,650,353,756,397,875,42],[471,625,505,748,594,874,50]],
    lion: [[285,658,232,746,176,832,52],[378,665,355,753,388,825,42],[444,634,500,736,575,829,60]],
    monkey: [[319,633,266,702,224,779,48],[418,668,395,741,426,790,45],[478,606,531,689,630,776,56]],
    tiger: [[266,618,228,713,174,788,48],[352,654,330,744,337,792,44],[454,614,494,707,544,810,62]],
    zebra: [[300,588,239,686,203,785,44],[360,620,350,710,383,785,38],[452,591,470,708,516,824,46],[548,579,601,686,670,784,42]],
  };
  const TAU = Math.PI * 2;
  function region(part, x, y) {
    const distance = Math.hypot((x-part[0])/part[2], (y-part[1])/part[3]);
    return 1 - motion.smooth((distance - .55) / .65);
  }
  function legs(rig, x, y) {
    const px=x+rig.x,py=y+rig.y;
    return joints[rig.species].map(([hx,hy,kx,ky,fx,fy,radius])=>{
      const t=Math.max(0,Math.min(1,(py-hy)/(fy-hy)));
      const lower=motion.smooth((py-ky+40)/80);
      const axis=py<ky ? hx+(kx-hx)*Math.max(0,(py-hy)/(ky-hy)) : kx+(fx-kx)*(py-ky)/(fy-ky);
      const mask=Math.exp(-Math.pow((px-axis)/radius,2)*profiles[rig.species].skinFalloff);
      const weight=motion.smooth(t/.24)*mask;
      return {weight,lower,foot:motion.smooth((py-fy+38)/38),knee:mask*Math.exp(-Math.pow((py-ky)/35,2)),t};
    });
  }
  function bonePose(joint,phase,profile,movement,bodyY, options = {}) {
    const [hx,hy,kx,ky,fx,fy]=joint;
    if(movement===0)return {upper:[1,0,0,0],lower:[1,0,0,0],foot:[1,0,0,0],hip:{x:hx,y:hy},knee:{x:kx,y:ky},ankle:{x:fx,y:fy}};
    const step=motion.footstep(phase,profile.stride,profile.lift,profile.stance);
    const hip={x:hx,y:hy+bodyY};
    const lengthScale=options.lengthScale ?? 1;
    const upperLength=Math.hypot(kx-hx,ky-hy)*lengthScale,lowerLength=Math.hypot(fx-kx,fy-ky)*lengthScale;
    const centre=hx+(options.forward ?? 4);
    const floor=options.floor ?? fy;
    const ankle={x:fx+(centre-fx+step.x)*movement,y:fy+(floor-fy-step.lift)*movement};
    let dx=ankle.x-hip.x,dy=ankle.y-hip.y;
    const distance=Math.hypot(dx,dy);dx/=distance;dy/=distance;
    const along=(upperLength*upperLength-lowerLength*lowerLength+distance*distance)/(2*distance);
    const height=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
    const pole=Math.sign((kx-hx)*(fy-hy)-(ky-hy)*(fx-hx))||-1;
    const knee={x:hip.x+dx*along+dy*height*pole,y:hip.y+dy*along-dx*height*pole};
    const upperAngle=Math.atan2(knee.y-hip.y,knee.x-hip.x)-Math.atan2(ky-hy,kx-hx);
    const lowerAngle=Math.atan2(ankle.y-knee.y,ankle.x-knee.x)-Math.atan2(fy-ky,fx-kx);
    const matrix=(x,y,target,angle,scale=1)=>{
      const c=Math.cos(angle)*scale,sn=Math.sin(angle)*scale;
      return [c,sn,target.x-c*x+sn*y,target.y-sn*x-c*y];
    };
    return {upper:matrix(hx,hy,hip,upperAngle,lengthScale),lower:matrix(kx,ky,knee,lowerAngle,lengthScale),
      foot:matrix(fx,fy,ankle,(-.12*Math.sin(step.swing*TAU))*(step.lift/profile.lift)),hip,knee,ankle,upperAngle,lowerAngle,step,lengthScale};
  }
  function transformed(matrix,x,y) {
    return {x:matrix[0]*x-matrix[1]*y+matrix[2]-x,y:matrix[1]*x+matrix[0]*y+matrix[3]-y};
  }
  function create(rig, columns = 18, rows = 20, coordinates) {
    const profile = profiles[rig.species];
    const vertices = [], triangles = [];
    // Extra grid lines frame each eye so blinking can compress its ink without
    // replacing it with an artificial lid or painting over the scanned colors.
    const xs = Array.from({length:columns+1}, (_,i) => i*rig.width/columns);
    const ys = Array.from({length:rows+1}, (_,i) => i*rig.height/rows);
    // Give thin tails enough vertices to bend smoothly, even on the small rear row.
    const [tx,ty,rx,ry] = profile.tail;
    for (const offset of [-.6,0,.6]) {
      xs.push(tx+rx*offset-rig.x);
      const y=ty+ry*offset;
      // Grid rows span the whole image; preserve the calibrated blink spacing.
      if (!profile.eyes.some(eye=>Math.abs(y-eye[1])<eye[3]*2+8)) ys.push(y-rig.y);
    }
    for (const [x,y,rx,ry] of profile.eyes) {
      xs.push(x-rig.x-rx*2, x-rig.x-rx*.9, x-rig.x, x-rig.x+rx*.9, x-rig.x+rx*2);
      ys.push(y-rig.y-ry*2, y-rig.y-ry*.85, y-rig.y, y-rig.y+ry*.85, y-rig.y+ry*2);
    }
    for(const [hx,hy,kx,ky,fx,fy,radius] of joints[rig.species]) {
      xs.push(kx-rig.x-radius*.7,kx-rig.x,kx-rig.x+radius*.7);
      ys.push(ky-rig.y-26,ky-rig.y,ky-rig.y+26);
    }
    const sorted = (values, max) => [...new Set(values.filter(v=>v>=0&&v<=max).map(v=>Math.round(v*1000)/1000))].sort((a,b)=>a-b);
    const gridX = sorted(xs,rig.width), gridY = sorted(ys,rig.height);
    const points=coordinates ?? gridY.flatMap(py=>gridX.map(px=>[px,py]));
    for (const [px,py] of points) {
      const lx=px+rig.x, ly=py+rig.y, leg=legs(rig,px,py);
      vertices.push({x:px,y:py, legs:leg, weights:leg.map(l=>l.weight),
        head: region(profile.head,lx,ly)*(1-motion.smooth((ly-profile.head[5]+10)/90)), tail: region(profile.tail,lx,ly),
        tailReach: motion.smooth(Math.hypot(lx-profile.tail[4],ly-profile.tail[5]) / (Math.max(profile.tail[2],profile.tail[3])*1.7)),
        extra: profile.extra ? region(profile.extra,lx,ly) : 0,
        eyes: profile.eyes.map(([x,y,rx,ry]) => {
          const dx=Math.abs((lx-x)/rx), dy=Math.abs((ly-y)/ry);
          // Flat inner patch; the outer ring blends into the face continuously.
          return 1-motion.smooth((Math.max(dx,dy)-.9)/1.1);
        }),
        body: 1-motion.smooth((ly-Math.min(...rig.feet.map(f=>f[1])))/150),
      });
    }
    if(!coordinates)for (let y=0;y<gridY.length-1;y++) for(let x=0;x<gridX.length-1;x++) {
      const a=y*gridX.length+x,b=a+1,c=a+gridX.length,d=c+1;
      triangles.push([a,b,c],[b,d,c]);
    }
    return {vertices,triangles,top:0,rig,profile};
  }
  function blinkAt(time, phase, species) {
    const period=profiles[species].blinkPeriod;
    const cycle=Math.floor((time+phase)/period);
    const local=(time+phase)%period;
    // Small deterministic variation between blinks and occasional double blinks.
    const start=period-.55 + Math.sin(cycle*2.17+phase)*.16;
    const pulse=t => t>=0&&t<.22 ? Math.pow(Math.sin(Math.PI*t/.22),2) : 0;
    return Math.max(pulse(local-start), cycle%4===2 ? pulse(local-start-.29) : 0);
  }
  function rotate(part, x, y, angle, weight) {
    const dx=x-part[4],dy=y-part[5];
    return {x:((Math.cos(angle)-1)*dx-Math.sin(angle)*dy)*weight,
      y:(Math.sin(angle)*dx+(Math.cos(angle)-1)*dy)*weight};
  }
  function deform(mesh, gait, movement = 1, time = 0, phase = 0, blink = 0) {
    const {rig,profile} = mesh;
    // A slow, independent neck motion keeps the head alive between steps.
    // Blend in on arrival; each animal's phase slightly varies its timing.
    const settle=motion.smooth(time/1.5);
    const headClock=time*profile.headSwayRate*(.92+.08*Math.sin(phase*1.31))+phase;
    const nod=Math.sin((gait-.08)*TAU*profile.headRate)*profile.nod*movement*.55
      + (Math.sin(headClock)*.82+Math.sin(headClock*.51+phase*.73)*.18)*profile.headSway*settle;
    const headLift=Math.sin(gait*TAU)*profile.headBob*movement*.55
      + Math.sin(headClock*.79+phase*.5)*profile.headBob*.35*settle;
    const tailClock=time*profile.tailRate+phase;
    const pelvisY=(profile.crouch+Math.cos(gait*TAU*2)*profile.bob)*movement;
    const shoulderY=(profile.crouch+Math.cos((gait+.25)*TAU*2)*profile.bob)*movement;
    const anatomy=joints[rig.species];
    const rearX=Math.min(...anatomy.map(j=>j[0])),frontX=Math.max(...anatomy.map(j=>j[0]));
    const bodyAt=x=>pelvisY+(shoulderY-pelvisY)*motion.smooth((x-rearX)/(frontX-rearX));
    const poses=anatomy.map((joint,i)=>bonePose(joint,gait+profile.phases[i],profile,movement,bodyAt(joint[0])));
    return mesh.vertices.map(v => {
      const lx=v.x+rig.x, ly=v.y+rig.y;
      let dx=0,dy=bodyAt(lx)*v.body;
      const head=rotate(profile.head,lx,ly,nod,v.head);
      dx+=head.x; dy+=head.y-headLift*v.head;
      const tailWeight=v.tail*(profile.tailFloor ? 1-motion.smooth((ly-profile.tailFloor+50)/50) : 1)
        * (profile.tailBodyEdge ? 1-motion.smooth((lx-profile.tailBodyEdge[0])/(profile.tailBodyEdge[1]-profile.tailBodyEdge[0])) : 1);
      // The tip follows the root with a small delay and a larger arc. Rotate
      // around the attachment point so the tail stays connected to the body.
      if (tailWeight>0) {
        const reach=v.tailReach;
        const tailAngle=(Math.sin(tailClock-reach*.6)*(.55+reach*.45)
          + Math.sin(tailClock*.47+phase)*.15)*profile.tailAngle*(time ? 1 : movement);
        const tail=rotate(profile.tail,lx,ly,tailAngle,tailWeight);
        dx+=tail.x;dy+=tail.y;
      }
      if(profile.extra) {
        const extra=rotate(profile.extra,lx,ly,Math.sin(time*1.6+phase)*profile.extraAngle*(time?1:movement),v.extra);
        dx+=extra.x;dy+=extra.y;
      }
      v.eyes.forEach((weight,i)=>{ dy-=(ly-profile.eyes[i][1])*blink*.92*weight; });
      return {x:v.x+dx,y:v.y+dy};
    });
  }
  let renderer;
  function getRenderer() {
    if (renderer !== undefined) return renderer;
    renderer = null;
    if (typeof document === 'undefined') return null;
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=512;
    const gl=canvas.getContext('webgl', {alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,antialias:false});
    if(!gl) return null;
    const compile=(type,source)=>{
      const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,`
      attribute vec2 position; attribute vec2 uv; varying vec2 textureUV;
      void main(){ gl_Position=vec4(position.x/256.0-1.0,1.0-position.y/256.0,0.0,1.0); textureUV=uv; }
    `));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`
      precision mediump float; varying vec2 textureUV; uniform sampler2D artwork;
      uniform vec4 eye0; uniform vec4 eye1; uniform float blink;
      vec2 closeEye(vec2 uv,vec4 eye){
        float horizontal=abs((uv.x-eye.x)/eye.z);
        float vertical=(uv.y-eye.y)/eye.w;
        if(horizontal>=2.0||abs(vertical)>=2.0)return uv;
        float scale=1.0-.92*blink*(1.0-smoothstep(.9,2.0,horizontal));
        float inner=.9*scale;
        float source=abs(vertical)<inner?vertical/scale:sign(vertical)*(.9+(abs(vertical)-inner)*1.1/(2.0-inner));
        uv.y=eye.y+source*eye.w;return uv;
      }
      void main(){ vec2 uv=textureUV;if(blink>0.0){uv=closeEye(uv,eye0);uv=closeEye(uv,eye1);}gl_FragColor=texture2D(artwork,uv); }
    `));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [name,offset] of [['position',0],['uv',8]]) {
      const attribute=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,16,offset);
    }
    gl.uniform1i(gl.getUniformLocation(program,'artwork'),0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    renderer={canvas,gl,buffer,textures:new WeakMap(),meshes:new WeakMap(),
      eyes:[gl.getUniformLocation(program,'eye0'),gl.getUniformLocation(program,'eye1')],blink:gl.getUniformLocation(program,'blink')};
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer=null;});
    canvas.addEventListener('webglcontextrestored',()=>{renderer=undefined;});
    return renderer;
  }
  function drawWarp(ctx,texture,mesh,target) {
    const gpu=getRenderer();
    if(!gpu) return false;
    const {canvas,gl}=gpu;
    gl.uniform1f(gpu.blink,mesh.textureBlink||0);
    if(mesh.textureBlink)mesh.profile.eyes.forEach(([x,y,rx,ry],i)=>gl.uniform4f(gpu.eyes[i],(x-mesh.rig.x)/mesh.rig.width,(y-mesh.rig.y)/mesh.rig.height,rx/mesh.rig.width,ry/mesh.rig.height));
    let image=gpu.textures.get(texture);
    if(!image) {
      image=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,image);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);
      gpu.textures.set(texture,image);
    } else gl.bindTexture(gl.TEXTURE_2D,image);
    let buffers=gpu.meshes.get(mesh);
    if(!buffers) {
      const indices=new Uint16Array(mesh.triangles.flat());
      const index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
      buffers={index,count:indices.length,data:new Float32Array(mesh.vertices.length*4)};
      gpu.meshes.set(mesh,buffers);
    }
    const padding=48;
    const w=mesh.rig.width+padding*2,h=mesh.rig.height+padding*2;
    const renderScale=Math.min(1,512/w,512/h);
    target.forEach((p,i)=>{
      buffers.data[i*4]=(p.x+padding)*renderScale;buffers.data[i*4+1]=(p.y+padding)*renderScale;
      buffers.data[i*4+2]=mesh.vertices[i].x/mesh.rig.width;
      buffers.data[i*4+3]=mesh.vertices[i].y/mesh.rig.height;
    });
    gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,buffers.data,gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffers.index);
    gl.viewport(0,0,512,512);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES,buffers.count,gl.UNSIGNED_SHORT,0);
    ctx.drawImage(canvas,0,0,w*renderScale,h*renderScale,-padding,-padding,w,h);
    return true;
  }
  const partsCache=new WeakMap();
  function axisAt(joint,y) {
    const [hx,hy,kx,ky,fx,fy]=joint;
    return y<ky ? hx+(kx-hx)*Math.max(0,(y-hy)/(ky-hy))
      : kx+(fx-kx)*Math.min(1.12,(y-ky)/(fy-ky));
  }
  const torsos={
    elephant:[340,625,112,86],giraffe:[364,635,105,87],lion:[365,628,124,106],
    monkey:[383,625,106,91],tiger:[357,599,118,108],zebra:[394,576,140,117],
  };
  const necks={elephant:[445,620,76,82],giraffe:[436,657,46,78],lion:[476,645,78,88],monkey:[480,584,47,50],tiger:[451,609,66,87],zebra:[490,552,65,100]};
  function torsoContains(species,x,y) {
    return [torsos[species],necks[species]].some(p=>((x-p[0])/p[2])**2+((y-p[1])/p[3])**2<=1);
  }
  // Source-art boundaries separate the torso/chest from the moving limbs.
  // A neck or mane extending below a simple ellipse must remain in the body.
  const bodyFloors={
    elephant:[[0,660],[210,642],[240,670],[300,700],[380,713],[420,705],[450,692],[500,665],[530,650],[840,650]],
    giraffe:[[0,690],[250,690],[280,697],[320,709],[425,716],[445,705],[475,695],[500,676],[520,625],[560,500],[840,500]],
    lion:[[0,652],[225,652],[250,675],[300,704],[375,733],[420,743],[450,734],[490,735],[530,716],[575,700],[610,680],[840,680]],
    monkey:[[0,658],[280,658],[310,670],[360,700],[440,708],[475,700],[520,685],[560,670],[575,660],[600,580],[840,580]],
    tiger:[[0,550],[200,550],[205,640],[235,658],[280,670],[350,690],[400,700],[445,685],[490,678],[530,668],[575,637],[590,568],[840,568]],
    zebra:[[0,660],[200,660],[235,650],[300,672],[360,683],[425,682],[455,680],[505,664],[545,650],[575,635],[600,555],[840,555]],
  };
  function bodyContains(mesh,x,y) {
    const points=bodyFloors[mesh.rig.species];
    for(let i=1;i<points.length;i++)if(x<=points[i][0]) {
      const a=points[i-1],b=points[i];
      return y<=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
    }
    return y<=points.at(-1)[1];
  }
  function ownerAt(mesh,x,y) {
    if(bodyContains(mesh,x,y))return -1;
    let owner=0,best=Infinity;
    joints[mesh.rig.species].forEach((joint,i)=>{
      const distance=Math.abs(x-axisAt(joint,y))/joint[6];
      if(distance<best) {best=distance;owner=i;}
    });
    return owner;
  }
  function limbMesh(rig,joint) {
    const [hx,hy,kx,ky,fx,fy,radius]=joint;
    const left=Math.min(hx,kx,fx)-radius*1.8,right=Math.max(hx,kx,fx)+radius*1.8;
    const top=hy-16,bottom=fy+radius*1.4;
    const xs=Array.from({length:9},(_,i)=>left+(right-left)*i/8);
    const ys=Array.from({length:17},(_,i)=>top+(bottom-top)*i/16);
    ys.push(hy,hy+12,hy+28,ky-18,ky,ky+18,fy-32,fy-4,fy,fy+radius);
    ys.sort((a,b)=>a-b);
    const rows=[...new Set(ys)];
    const vertices=[];
    for(const y of rows)for(const x of xs)vertices.push({x:x-rig.x,y:y-rig.y,
      lower:motion.smooth((y-ky+18)/36),foot:motion.smooth((y-fy+32)/28),root:motion.smooth((y-hy)/28)});
    const triangles=[];
    for(let y=0;y<rows.length-1;y++)for(let x=0;x<xs.length-1;x++) {
      const a=y*xs.length+x,b=a+1,c=a+xs.length,d=c+1;triangles.push([a,b,c],[b,d,c]);
    }
    return {rig,vertices,triangles,joint};
  }
  function prepareParts(mesh,texture) {
    let parts=partsCache.get(texture);if(parts)return parts;
    const probe=document.createElement('canvas');probe.width=texture.width;probe.height=texture.height;
    const paint=probe.getContext('2d',{willReadFrequently:true});paint.drawImage(texture,0,0);
    const pixels=paint.getImageData(0,0,probe.width,probe.height);
    const buffers=Array.from({length:joints[mesh.rig.species].length+1},()=>paint.createImageData(probe.width,probe.height));
    const soles=joints[mesh.rig.species].map(j=>j[5]);
    for(let y=0;y<probe.height;y++)for(let x=0;x<probe.width;x++) {
      const at=(y*probe.width+x)*4;if(!pixels.data[at+3])continue;
      const px=mesh.rig.x+x/probe.width*mesh.rig.width,py=mesh.rig.y+y/probe.height*mesh.rig.height;
      const owner=ownerAt(mesh,px,py);
      const target=owner<0?0:owner+1;
      for(let c=0;c<4;c++)buffers[target].data[at+c]=pixels.data[at+c];
      if(owner>=0 && pixels.data[at+3]>32)soles[owner]=Math.max(soles[owner],py+mesh.rig.height/probe.height);
      // A small collar overlaps the torso; it stays still at the root and blends
      // into the upper bone. The scan supplies all colors and outlines.
      if(owner<0)joints[mesh.rig.species].forEach((joint,i)=>{
        if(py>=joint[1]-12 && py<joint[3]+12 && Math.abs(px-axisAt(joint,py))<joint[6]*.85)
          for(let c=0;c<4;c++)buffers[i+1].data[at+c]=pixels.data[at+c];
      });
    }
    // Reconstruct the small occluded belly area from this scan's own nearby
    // torso colors. It sits behind the original torso and moving limbs.
    const torso=torsos[mesh.rig.species];
    for(let y=0;y<probe.height;y++)for(let x=0;x<probe.width;x++) {
      const at=(y*probe.width+x)*4;
      if(buffers[0].data[at+3])continue;
      const px=mesh.rig.x+x/probe.width*mesh.rig.width,py=mesh.rig.y+y/probe.height*mesh.rig.height;
      if(!torsoContains(mesh.rig.species,px,py)||!bodyContains(mesh,px,py))continue;
      let sample=-1;
      for(let dy=1;dy<180 && y-dy>=0;dy++) {
        const source=((y-dy)*probe.width+x)*4;
        if(buffers[0].data[source+3]>220 && pixels.data[source]+pixels.data[source+1]+pixels.data[source+2]>150) {sample=source;break;}
      }
      if(sample>=0)for(let c=0;c<4;c++)buffers[0].data[at+c]=pixels.data[sample+c];
    }
    const textures=buffers.map(buffer=>{
      const canvas=document.createElement('canvas');canvas.width=probe.width;canvas.height=probe.height;
      canvas.getContext('2d').putImageData(buffer,0,0);return canvas;
    });
    parts={body:textures[0],limbs:textures.slice(1),soles,meshes:joints[mesh.rig.species].map(j=>limbMesh(mesh.rig,j))};
    partsCache.set(texture,parts);return parts;
  }
  let limbAdapter;
  function limbTarget(mesh,pose,bodyY) {
    if(limbAdapter)return limbAdapter(mesh,pose,bodyY);
    const [hx,hy,kx,ky,fx,fy]=mesh.joint;
    return mesh.vertices.map(v=>{
      const x=v.x+mesh.rig.x,y=v.y+mesh.rig.y;
      const angle=pose.upperAngle+(pose.lowerAngle-pose.upperAngle)*v.lower;
      const c=Math.cos(angle)*pose.lengthScale,sn=Math.sin(angle)*pose.lengthScale;
      const hinged={x:pose.knee.x+c*(x-kx)-sn*(y-ky),y:pose.knee.y+sn*(x-kx)+c*(y-ky)};
      const foot=transformed(pose.foot,x,y);
      const bx=hinged.x+(x+foot.x-hinged.x)*v.foot,by=hinged.y+(y+foot.y-hinged.y)*v.foot;
      return {x:x+(bx-x)*v.root-mesh.rig.x,y:y+bodyY+(by-y-bodyY)*v.root-mesh.rig.y};
    });
  }
  function drawMesh(ctx,texture,mesh,target) {
    if(drawWarp(ctx,texture,mesh,target))return;
    drawCanvasMesh(ctx,texture,mesh,target);
  }
  function poseRig(texture,rig,mesh,gait,movement,groundBaseline) {
    const parts=prepareParts(mesh,texture);
    return {parts,...poseFromSoles(rig,mesh,gait,movement,groundBaseline,parts.soles)};
  }
  function poseFromSoles(rig,mesh,gait,movement,groundBaseline,soles) {
    const profile=mesh.profile,anatomy=joints[rig.species];
    const baseline=rig.y+(groundBaseline ?? rig.height);
    const far=i=>i===1 || i===3;
    const floors=anatomy.map((joint,i)=>baseline-(soles[i]-joint[5])-(far(i)?Math.max(10,baseline-soles[i]):0));
    // Keep every contact target within reach for the whole stance sweep.
    let restY=profile.crouch;
    anatomy.forEach((j,i)=>{
      const reach=(Math.hypot(j[2]-j[0],j[3]-j[1])+Math.hypot(j[4]-j[2],j[5]-j[3]))*.975;
      restY=Math.max(restY,floors[i]-j[1]-Math.sqrt(Math.max(1,reach*reach-(profile.stride*.56+4)**2))+profile.bob);
    });
    const bodyY=restY+Math.cos(gait*TAU*2)*profile.bob;
    const poses=anatomy.map((joint,i)=>{
      const total=Math.hypot(joint[2]-joint[0],joint[3]-joint[1])+Math.hypot(joint[4]-joint[2],joint[5]-joint[3]);
      const vertical=floors[i]-joint[1]-restY;
      // The drawing projects its near and far limbs at different lengths.
      // Calibrate a standing pose once instead of forcing a deep crouch in the
      // very long, outstretched front leg. Paws retain their original size.
      const neutral=Math.hypot(vertical,4)/(total*.94);
      const sweep=Math.hypot(vertical+profile.bob,profile.stride*.56+4)/(total*.985);
      const lengthScale=Math.min(1,Math.max(.78,neutral,sweep));
      return bonePose(joint,gait+profile.phases[i],profile,movement,bodyY,{floor:floors[i],lengthScale});
    });
    return {poses,bodyY,floors};
  }
  function draw(ctx, texture, rig, mesh, gait, movement, time = 0, phase = 0, blinkOverride, groundBaseline) {
    if(movement===0) {
      drawMesh(ctx,texture,mesh,deform(mesh,gait,0,time,phase,blinkOverride ?? blinkAt(time,phase,rig.species)));
      return;
    }
    const {parts,poses,bodyY}=poseRig(texture,rig,mesh,gait,movement,groundBaseline);
    const anatomy=joints[rig.species],far=i=>i===1||i===3;
    const body=deform(mesh,gait,0,time,phase,blinkOverride ?? blinkAt(time,phase,rig.species));
    for(const p of body)p.y+=bodyY;
    for(let i=0;i<anatomy.length;i++)if(far(i))drawMesh(ctx,parts.limbs[i],parts.meshes[i],limbTarget(parts.meshes[i],poses[i],bodyY));
    for(let i=0;i<anatomy.length;i++)if(!far(i))drawMesh(ctx,parts.limbs[i],parts.meshes[i],limbTarget(parts.meshes[i],poses[i],bodyY));
    drawMesh(ctx,parts.body,mesh,body);
  }
  function drawCanvasMesh(ctx,texture,mesh,target) {
    const {rig}=mesh;
    const ratioX = texture.width / rig.width, ratioY = texture.height / rig.height;
    for (const triangle of mesh.triangles) {
      const [a,b,c] = triangle.map(i => mesh.vertices[i]);
      const [p,q,r] = triangle.map(i => target[i]);
      const det = (b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
      const m11 = ((q.x-p.x)*(c.y-a.y)-(r.x-p.x)*(b.y-a.y))/det;
      const m12 = ((q.y-p.y)*(c.y-a.y)-(r.y-p.y)*(b.y-a.y))/det;
      const m21 = ((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(c.x-a.x))/det;
      const m22 = ((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(c.x-a.x))/det;
      ctx.save();
      ctx.beginPath();
      // Small clip overlap prevents antialias seams between adjacent triangles.
      const cx=(p.x+q.x+r.x)/3, cy=(p.y+q.y+r.y)/3;
      [p,q,r].forEach((v,i) => {
        const length=Math.hypot(v.x-cx,v.y-cy);
        const x=v.x+(v.x-cx)/length*.45, y=v.y+(v.y-cy)/length*.45;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.closePath(); ctx.clip();
      ctx.transform(m11,m12,m21,m22,p.x-m11*a.x-m21*a.y,p.y-m12*a.x-m22*a.y);
      const x = Math.max(0,Math.min(a.x,b.x,c.x)-1), y = Math.max(0,Math.min(a.y,b.y,c.y)-1);
      const w = Math.min(rig.width,Math.max(a.x,b.x,c.x)+1)-x;
      const h = Math.min(rig.height,Math.max(a.y,b.y,c.y)+1)-y;
      ctx.drawImage(texture,x*ratioX,y*ratioY,w*ratioX,h*ratioY,x,y,w,h);
      ctx.restore();
    }
  }
  return { STRIDE, profiles, joints, bonePose, create, deform, limbMesh, limbTarget, ownerAt, prepareParts, poseRig, poseFromSoles, drawMesh, draw, blinkAt, supportsWebGL:()=>!!getRenderer(), setLimbAdapter: adapter=>{limbAdapter=adapter;}, rendererMode: () => renderer ? 'WebGL' : 'Canvas' };
});
