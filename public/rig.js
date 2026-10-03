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
    elephant: { stride: 46, lift: 20, stance: .76, crouch: 4, skinFalloff: 0.36, phases: [0,.5,.25], bob: 1,
      head: [468,445,250,220,455,570], nod: .022, headBob: 3, headRate: 1,
      tail: [174,606,90,80,244,579], tailAngle: .115, tailRate: .85,
      extra: [629,567,125,74,529,511], extraAngle: .055,
      eyes: [[435,451,15,23],[566,433,13,21]], blinkPeriod: 5.7 },
    giraffe: { stride: 60, lift: 28, stance: .72, crouch: 12, skinFalloff: 0.24, phases: [0,.5,.25], bob: 3,
      head: [566,337,200,230,429,631], nod: .025, headBob: 4, headRate: .5,
      tail: [188,685,102,76,277,657], tailAngle: .145, tailRate: 1.05,
      eyes: [[549,350,15,23],[656,319,12,20]], blinkPeriod: 6.2 },
    lion: { stride: 54, lift: 24, stance: .72, crouch: 12, skinFalloff: 0.28, phases: [0,.5,.25], bob: 3,
      head: [508,450,235,249,449,627], nod: .035, headBob: 4, headRate: 1,
      tail: [154,502,90,128,244,604], tailAngle: .14, tailRate: .9,
      eyes: [[491,431,15,22],[608,412,13,21]], blinkPeriod: 5.1 },
    monkey: { stride: 48, lift: 32, stance: .70, crouch: 2, skinFalloff: 0.28, phases: [0,.5,.25], bob: 4,
      head: [517,432,213,174,488,572], nod: .055, headBob: 6, headRate: 1,
      tail: [194,505,112,159,294,626], tailAngle: .12, tailRate: 1.15,
      eyes: [[496,451,15,22],[610,429,15,22]], blinkPeriod: 4.3 },
    tiger: { stride: 58, lift: 20, stance: .74, crouch: 12, skinFalloff: 0.28, phases: [0,.5,.25], bob: 2,
      head: [536,429,208,192,456,594], nod: .026, headBob: 2, headRate: .5,
      tail: [174,416,88,131,276,519], tailAngle: .135, tailRate: .8,
      eyes: [[508,414,16,24],[631,399,13,22]], blinkPeriod: 6.5 },
    zebra: { stride: 58, lift: 28, stance: .72, crouch: 12, skinFalloff: 0.28, phases: [0,.5,.25,.75], bob: 3,
      head: [593,387,165,180,466,568], nod: .04, headBob: 5, headRate: 1,
      tail: [168,595,100,62,278,581], tailAngle: .15, tailRate: 1.25, tailFloor: 640,
      eyes: [[575,410,16,23],[683,397,11,20]], blinkPeriod: 4.9 },
  };
  // [hipX, hipY, knee/hockX, knee/hockY, footX, footY, skinRadius].
  // The source drawings already contain bent limbs; those are the bind pose.
  const joints = {
    elephant: [[276,615,236,711,175,760,58],[350,626,348,725,347,780,46],[445,600,482,710,515,783,58]],
    giraffe: [[312,577,259,732,159,889,42],[364,630,353,756,409,911,42],[448,583,505,748,624,907,50]],
    lion: [[293,611,232,746,164,858,52],[374,625,355,753,397,851,42],[435,592,500,736,604,862,60]],
    monkey: [[325,595,266,702,207,799,48],[410,640,395,741,430,816,45],[467,572,531,689,652,803,56]],
    tiger: [[279,564,228,713,167,818,48],[350,625,330,744,344,824,44],[440,555,494,707,572,842,62]],
    zebra: [[300,556,239,686,191,809,44],[364,601,350,710,393,809,38],[451,545,470,708,530,855,46],[542,553,601,686,688,809,42]],
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
  function bonePose(joint,phase,profile,movement,bodyY) {
    const [hx,hy,kx,ky,fx,fy]=joint;
    if(movement===0)return {upper:[1,0,0,0],lower:[1,0,0,0],foot:[1,0,0,0],hip:{x:hx,y:hy},knee:{x:kx,y:ky},ankle:{x:fx,y:fy}};
    const step=motion.footstep(phase,profile.stride,profile.lift,profile.stance);
    const hip={x:hx,y:hy+bodyY};
    const upperLength=Math.hypot(kx-hx,ky-hy),lowerLength=Math.hypot(fx-kx,fy-ky);
    // Author the contact target inside the fixed-length leg's reach. Keeping a
    // small reserve bend prevents the IK singularity at a fully straight knee.
    const reach=(upperLength+lowerLength)*.985;
    const stanceHipY=hy+profile.crouch-profile.bob;
    const horizontal=Math.sqrt(Math.max(profile.stride**2,reach**2-(fy-stanceHipY)**2));
    const centre=Math.max(hx-horizontal+profile.stride*.56,Math.min(hx+horizontal-profile.stride*.56,fx));
    const ankle={x:fx+(centre-fx+step.x)*movement,y:fy-step.lift*movement};
    let dx=ankle.x-hip.x,dy=ankle.y-hip.y;
    const distance=Math.hypot(dx,dy);dx/=distance;dy/=distance;
    const along=(upperLength*upperLength-lowerLength*lowerLength+distance*distance)/(2*distance);
    const height=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
    const pole=Math.sign((kx-hx)*(fy-hy)-(ky-hy)*(fx-hx))||-1;
    const knee={x:hip.x+dx*along+dy*height*pole,y:hip.y+dy*along-dx*height*pole};
    const upperAngle=Math.atan2(knee.y-hip.y,knee.x-hip.x)-Math.atan2(ky-hy,kx-hx);
    const lowerAngle=Math.atan2(ankle.y-knee.y,ankle.x-knee.x)-Math.atan2(fy-ky,fx-kx);
    const matrix=(x,y,target,angle)=>{
      const c=Math.cos(angle),sn=Math.sin(angle);
      return [c,sn,target.x-c*x+sn*y,target.y-sn*x-c*y];
    };
    return {upper:matrix(hx,hy,hip,upperAngle),lower:matrix(kx,ky,knee,lowerAngle),
      foot:matrix(fx,fy,ankle,(-.14*Math.sin(step.swing*TAU))*(step.lift/profile.lift)),hip,knee,ankle};
  }
  function transformed(matrix,x,y) {
    return {x:matrix[0]*x-matrix[1]*y+matrix[2]-x,y:matrix[1]*x+matrix[0]*y+matrix[3]-y};
  }
  function create(rig, columns = 18, rows = 20) {
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
    for (const py of gridY) for (const px of gridX) {
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
    for (let y=0;y<gridY.length-1;y++) for(let x=0;x<gridX.length-1;x++) {
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
    const nod=Math.sin((gait-.08)*TAU*profile.headRate)*profile.nod*movement
      + Math.sin(time*.75+phase)*profile.nod*.35*(time ? 1 : 0);
    const tailClock=time*profile.tailRate+phase;
    const pelvisY=(profile.crouch+Math.cos(gait*TAU*2)*profile.bob)*movement;
    const shoulderY=(profile.crouch+Math.cos((gait+.25)*TAU*2)*profile.bob)*movement;
    const anatomy=joints[rig.species];
    const rearX=Math.min(...anatomy.map(j=>j[0])),frontX=Math.max(...anatomy.map(j=>j[0]));
    const bodyAt=x=>pelvisY+(shoulderY-pelvisY)*motion.smooth((x-rearX)/(frontX-rearX));
    const poses=anatomy.map((joint,i)=>bonePose(joint,gait+profile.phases[i],profile,movement,bodyAt(joint[0])));
    return mesh.vertices.map(v => {
      const lx=v.x+rig.x, ly=v.y+rig.y;
      let dx=0,dy=0,total=0;
      v.legs.forEach((leg,i)=>{
        const pose=poses[i],upper=transformed(pose.upper,lx,ly),lower=transformed(pose.lower,lx,ly),foot=transformed(pose.foot,lx,ly);
        const bx=upper.x+(lower.x-upper.x)*leg.lower,by=upper.y+(lower.y-upper.y)*leg.lower;
        dx+=(bx+(foot.x-bx)*leg.foot)*leg.weight;
        dy+=(by+(foot.y-by)*leg.foot)*leg.weight;
        total+=leg.weight;
      });
      dx/=Math.max(1,total); dy/=Math.max(1,total);
      dy+=bodyAt(lx)*v.body*(1-Math.min(1,total));
      const head=rotate(profile.head,lx,ly,nod,v.head);
      dx+=head.x; dy+=head.y-Math.sin(gait*TAU)*profile.headBob*movement*v.head;
      const tailWeight=v.tail*(profile.tailFloor ? 1-motion.smooth((ly-profile.tailFloor+50)/50) : 1);
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
      void main(){ gl_FragColor=texture2D(artwork,textureUV); }
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
    renderer={canvas,gl,buffer,textures:new WeakMap(),meshes:new WeakMap()};
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer=null;});
    canvas.addEventListener('webglcontextrestored',()=>{renderer=undefined;});
    return renderer;
  }
  function drawWarp(ctx,texture,mesh,target) {
    const gpu=getRenderer();
    if(!gpu) return false;
    const {canvas,gl}=gpu;
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
  const contacts=new WeakMap();
  function footContact(mesh,texture,target) {
    let samples=contacts.get(texture);
    if(!samples) {
      samples=[];
      const probe=document.createElement('canvas');probe.width=texture.width;probe.height=texture.height;
      const paint=probe.getContext('2d',{willReadFrequently:true});paint.drawImage(texture,0,0);
      const pixels=paint.getImageData(0,0,probe.width,probe.height).data;
      for(let x=0;x<probe.width;x+=Math.max(1,Math.floor(probe.width/96))) {
        let y=probe.height-1;
        while(y>=0&&pixels[(y*probe.width+x)*4+3]<=32)y--;
        if(y<probe.height*.55)continue;
        const px=x/probe.width*mesh.rig.width,py=(y+1)/probe.height*mesh.rig.height;
        for(const triangle of mesh.triangles) {
          const [a,b,c]=triangle.map(i=>mesh.vertices[i]);
          const det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
          const v=((px-a.x)*(c.y-a.y)-(c.x-a.x)*(py-a.y))/det;
          const w=((b.x-a.x)*(py-a.y)-(px-a.x)*(b.y-a.y))/det;
          if(v>=-.0001&&w>=-.0001&&v+w<=1.0001){samples.push({triangle,weights:[1-v-w,v,w]});break;}
        }
      }
      contacts.set(texture,samples);
    }
    return samples.length ? Math.max(...samples.map(s=>s.triangle.reduce((y,i,k)=>y+target[i].y*s.weights[k],0))) : mesh.rig.height;
  }
  function draw(ctx, texture, rig, mesh, gait, movement, time = 0, phase = 0, blinkOverride, groundBaseline) {
    const target = deform(mesh, gait, movement, time, phase, blinkOverride ?? blinkAt(time,phase,rig.species));
    if(groundBaseline!==undefined) {
      // Keep the lowest visible sole on the trail throughout the stride,
      // including poses where the drawing's lowest bind-pose foot is lifted.
      const correction=groundBaseline-footContact(mesh,texture,target);
      for(const point of target)point.y+=correction;
    }
    // A shared GPU mesh rasterizes adjacent triangles without clip seams.
    // Canvas fallback keeps the animation available on devices without WebGL.
    if(drawWarp(ctx,texture,mesh,target)) return;
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
  return { STRIDE, profiles, joints, bonePose, create, deform, draw, blinkAt, rendererMode: () => renderer ? 'WebGL' : 'Canvas' };
});
