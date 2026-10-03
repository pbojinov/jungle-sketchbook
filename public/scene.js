/* Original Canvas artwork. Visual references and rationale: SCENE-NOTES.md. */
const JungleScene = (() => {
  let cache;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function random(seed) {
    let state = seed;
    return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  }
  function surface(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    return [canvas, canvas.getContext('2d')];
  }
  function glow(ctx, x, y, radius, color) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  // Every leaf has a filled asymmetric blade, a curved midrib, and fine secondary veins.
  function leaf(ctx, x, y, length, breadth, angle, colors, detail = true) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const gradient = ctx.createLinearGradient(-breadth, 0, breadth, -length);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.52, colors[1]);
    gradient.addColorStop(1, colors[2]);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-breadth * 0.7, -length * 0.17, -breadth, -length * 0.58, length * 0.09, -length);
    ctx.bezierCurveTo(breadth * 0.5, -length * 0.68, breadth * 0.85, -length * 0.26, 0, 0);
    ctx.fill();
    ctx.strokeStyle = colors[2];
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = Math.max(0.65, length * 0.006);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-length * 0.025, -length * 0.48, length * 0.09, -length * 0.97);
    ctx.stroke();
    if (detail) {
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 0.7;
      for (let i = 1; i < 7; i++) {
        const t = i / 8;
        const spread = Math.sin(t * Math.PI) * breadth * 0.58;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(length * 0.04 * t, -length * t);
          ctx.quadraticCurveTo(spread * side * 0.55, -length * (t + 0.09), spread * side, -length * (t + 0.14));
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  function fern(ctx, x, y, length, angle, colors, seed) {
    const rng = random(seed);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const curl = length * 0.27;
    ctx.strokeStyle = colors[1];
    ctx.lineWidth = Math.max(1, length * 0.009);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-curl * 0.12, -length * 0.65, curl, -length);
    ctx.stroke();
    for (let i = 1; i < 16; i++) {
      const t = i / 16;
      const px = curl * t * t;
      const py = -length * t;
      const size = length * 0.27 * Math.pow(Math.sin(Math.PI * t), 0.65) * (0.9 + rng() * 0.2);
      for (const side of [-1, 1]) {
        leaf(ctx, px, py, size, size * 0.16, side * (0.95 - 0.3 * t), colors, false);
      }
    }
    leaf(ctx, curl * 0.87, -length * 0.92, length * 0.13, length * 0.016, 0.3, colors, false);
    ctx.restore();
  }
  function tree(ctx, x, ground, thickness, colors, seed) {
    const rng = random(seed);
    const lean = (rng() - 0.5) * thickness * 1.6;
    const gradient = ctx.createLinearGradient(x - thickness, 0, x + thickness, 0);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.62, colors[1]);
    gradient.addColorStop(1, colors[0]);
    const trunk = new Path2D();
    trunk.moveTo(x - thickness * 1.7, ground);
    trunk.bezierCurveTo(x - thickness * 0.55, ground * 0.92, x - thickness * 0.53, ground * 0.5, x + lean - thickness * 0.3, -20);
    trunk.lineTo(x + lean + thickness * 0.33, -20);
    trunk.bezierCurveTo(x + thickness * 0.38, ground * 0.52, x + thickness * 0.53, ground * 0.93, x + thickness * 1.75, ground);
    trunk.bezierCurveTo(x + thickness * 0.4, ground * 0.98, x - thickness * 0.25, ground * 0.985, x - thickness * 1.7, ground);
    ctx.fillStyle = gradient;
    ctx.fill(trunk);
    ctx.save();
    ctx.clip(trunk);
    for (let i = 0; i < 24; i++) {
      const bx = x + (rng() - 0.5) * thickness * 1.5;
      const by = rng() * ground;
      ctx.strokeStyle = i % 3 ? colors[2] : colors[0];
      ctx.globalAlpha = 0.15 + rng() * 0.12;
      ctx.lineWidth = 0.6 + rng() * 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.bezierCurveTo(bx - 4, by + 35, bx + 5, by + 75, bx - 3, by + 150);
      ctx.stroke();
    }
    ctx.restore();
    // Branches live high in the canopy, leaving the animal lanes open.
    for (const side of [-1, 1]) {
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = thickness * 0.19;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + lean, ground * 0.22);
      ctx.bezierCurveTo(x + side * thickness * 0.8, ground * 0.18, x + side * thickness * 2.1, ground * 0.12, x + side * thickness * 2.6, -10);
      ctx.stroke();
    }
  }
  const palettes = [
    ['#082c30', '#155b56', '#489783'],
    ['#102f3f', '#246765', '#65aaa0'],
    ['#231e3e', '#4d3f68', '#99759b'],
    ['#0a3539', '#25756d', '#78b9a0'],
  ];
  function plantSprite(kind, seed, palette) {
    const [canvas, ctx] = surface(420, 420);
    const rng = random(seed);
    if (kind === 'fern') {
      for (let i = 0; i < 7; i++) {
        fern(ctx, 210, 400, 200 + rng() * 130, (i - 3) * 0.32, palette, seed + i * 13);
      }
    } else {
      for (let i = 0; i < 7; i++) {
        leaf(ctx, 210 + (rng() - 0.5) * 12, 410, 170 + rng() * 160, 45 + rng() * 40, (i - 3) * 0.31, palette);
      }
    }
    return canvas;
  }
  // One slow breeze drives the foliage, with a delayed response at each depth.
  // Amplitudes are in radians; the camera, trunks and ground remain steady.
  function breeze(seconds, phase=0) {
    return Math.sin(seconds*.50+phase)*.65 + Math.sin(seconds*.21+phase*.7)*.25
      + Math.sin(seconds*1.15+phase*1.3)*.10;
  }
  function leafSprite(length,breadth,palette,detail=true) {
    const [canvas,ctx]=surface(length*2,length*2);
    leaf(ctx,length,length,length,breadth,0,palette,detail);
    return canvas;
  }
  function canopyLeaf(ctx,item,seconds) {
    const sway=breeze(seconds,item.phase)*item.flex;
    const flutter=Math.sin(seconds*1.4+item.phase)*.012;
    ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.angle+sway+flutter);
    // The petiole stays fixed; tips move farther than the base.
    ctx.transform(1,0,breeze(seconds-.6,item.phase)*.026,1,0,0);
    ctx.drawImage(item.sprite,-item.length,-item.length);ctx.restore();
  }
  function vinePoint(item,t,seconds) {
    const u=1-t;
    const curve=-24*3*u*u*t + 20*3*u*t*t - 5*t*t*t;
    const swing=breeze(seconds-t*.8,item.phase)*item.flex*t*t;
    return {x:item.x+curve+swing,y:-5+(item.length+5)*t};
  }
  function vine(ctx,item,seconds) {
    ctx.strokeStyle='#327067';ctx.lineWidth=1.2;
    ctx.beginPath();
    for(let i=0;i<=20;i++) {
      const p=vinePoint(item,i/20,seconds);
      if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();
    item.leaves.forEach((blade,i)=>{
      const p=vinePoint(item,blade.t,seconds), q=vinePoint(item,Math.min(1,blade.t+.01),seconds);
      const lean=-Math.atan2(q.x-p.x,q.y-p.y);
      ctx.save();ctx.translate(p.x,p.y);
      ctx.rotate(blade.angle+lean+breeze(seconds-.8,item.phase+i*.6)*.06);
      ctx.drawImage(blade.sprite,-blade.length,-blade.length);ctx.restore();
    });
  }
  function groundY(width,height,layer,x,controlsHeight=0) {
    // The menu floats over the scene; it never lifts the animals off the bottom.
    const front=height-Math.max(12,height*.02);
    const spacing=height*.13;
    const t=Math.max(0,Math.min(1,x/width));
    return front-layer*spacing + height*.004*Math.sin(t*Math.PI*2+layer*.7);
  }
  function walkingPath(ctx,width,height,layer,controlsHeight) {
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    const points=()=>{
      ctx.beginPath();
      for(let i=0;i<=48;i++){
        const x=width*i/48,y=groundY(width,height,layer,x,controlsHeight);
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
    };
    // A broad, softly lit trail with a narrower worn centre; shadows sit on it.
    const breadth=height*(.042-layer*.006);
    ctx.strokeStyle=['#416c5b','#3f6557','#46675e','#4b7068'][layer];ctx.globalAlpha=.27;
    ctx.lineWidth=breadth;points();ctx.stroke();
    ctx.strokeStyle='#8b9d7940';ctx.lineWidth=breadth*.42;points();ctx.stroke();
    ctx.restore();
  }
  function build(width, height, controlsHeight=0) {
    const [back, ctx] = surface(width, height);
    const rng = random(4189);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#080f22');
    sky.addColorStop(0.35, '#162c3c');
    sky.addColorStop(0.7, '#123f43');
    sky.addColorStop(1, '#061d26');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    glow(ctx, width * 0.47, height * 0.38, Math.max(width, height) * 0.52, '#397e814b');
    glow(ctx, width * 0.82, height * 0.26, height * 0.62, '#64397545');
    // Distant slim trunks dissolve into the blue-green atmosphere.
    for (let i = 0; i < 20; i++) {
      const x = (i / 19 + (rng() - 0.5) * 0.035) * width;
      tree(ctx, x, height * (0.55 + rng() * 0.14), 9 + rng() * Math.min(width, height) * 0.026,
        ['#13333d', '#214850', '#49757a'], i + 80);
    }
    const shafts = ctx.createLinearGradient(0, 0, 0, height * 0.7);
    shafts.addColorStop(0, '#a8d9cf13');
    shafts.addColorStop(1, '#a8d9cf00');
    ctx.fillStyle = shafts;
    for (let i = 0; i < 5; i++) {
      const x = width * (0.22 + i * 0.12);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + width * 0.018, 0);
      ctx.lineTo(x - width * 0.15, height * 0.72); ctx.lineTo(x - width * 0.26, height * 0.72); ctx.fill();
    }
    [0.055, 0.235, 0.71, 0.955].forEach((fraction, i) => {
      tree(ctx, width * fraction, height * (0.78 + (i % 2) * 0.07), Math.min(width, height) * (i % 2 ? 0.045 : 0.065),
        ['#08252d', i % 2 ? '#133c40' : '#154445', '#50817b'], 130 + i);
    });
    // A continuous floor keeps shading from reading as an extra walking row.
    // The forest edge sits one equal interval behind the rear trail.
    const y=groundY(width,height,4,width*.5,controlsHeight);
    const ground = ctx.createLinearGradient(0, y - 20, 0, height);
    ground.addColorStop(0, '#235354');
    ground.addColorStop(.3, '#153d41');
    ground.addColorStop(1, '#061c26');
    ctx.fillStyle = ground;
    ctx.beginPath();ctx.moveTo(0, y + 12);
    ctx.bezierCurveTo(width * 0.3, y - height * 0.025, width * 0.53, y + height * 0.045, width, y - height * 0.018);
    ctx.lineTo(width, height);ctx.lineTo(0, height);ctx.fill();
    for(const layer of [3,2,1,0])walkingPath(ctx,width,height,layer,controlsHeight);
    // Moss and fallen leaves are low-contrast flecks, concentrated at the edges.
    for (let i = 0; i < 240; i++) {
      const x = rng() * width;
      const horizon=groundY(width,height,4,x,controlsHeight)+height*.015;
      const y = horizon + rng()*(height-horizon);
      ctx.globalAlpha = 0.08 + rng() * 0.12;
      ctx.fillStyle = ['#73a58a', '#588e86', '#91719b'][i % 3];
      ctx.beginPath();ctx.ellipse(x, y, 1 + rng() * 6, 0.5 + rng() * 1.2, rng() * 2, 0, Math.PI * 2);ctx.fill();
    }
    ctx.globalAlpha = 1;
    const canopy=[], vines=[];
    // Render each blade once, then animate it around its own attachment point.
    for(let i=0;i<36;i++) {
      const x=i/35*width,y=-12-rng()*20;
      const length=Math.min(width,height)*(.1+rng()*.15);
      const breadth=length*(.18+rng()*.16),angle=Math.PI+(rng()-.5)*1.4;
      canopy.push({x,y,length,angle,phase:i*.73,flex:.06+rng()*.025,
        sprite:leafSprite(length,breadth,palettes[i%4])});
    }
    for(let i=0;i<7;i++) {
      const x=width*[.08,.18,.31,.65,.81,.88,.98][i];
      const length=height*(.22+rng()*.23),leaves=[];
      for(let j=1;j<7;j++) {
        const size=18+rng()*14;
        leaves.push({t:j/7,length:size,angle:j%2?-1.3:1.3,
          sprite:leafSprite(size,8,palettes[i%2],false)});
      }
      vines.push({x,length,leaves,phase:i*1.13,flex:Math.min(width,height)*(.024+rng()*.012)});
    }
    const sprites = palettes.map((palette, i) => ({ fern: plantSprite('fern', 72 + i, palette), broad: plantSprite('broad', 91 + i, palette) }));
    const plants = [];
    // Framing plants are deliberately asymmetric; the centre remains an open stage.
    const positions = [
      [-0.025, 0.43, 0.48, 0, 'fern'], [1.025, 0.36, 0.43, 2, 'broad'],
      [-0.035, 0.70, 0.47, 1, 'broad'], [1.045, 0.72, 0.48, 0, 'fern'],
      [-0.02, 1.10, 0.53, 0, 'fern'], [0.07, 1.10, 0.37, 1, 'broad'],
      [0.21, 1.12, 0.29, 2, 'broad'], [0.84, 1.12, 0.33, 2, 'fern'],
      [0.99, 1.12, 0.5, 3, 'broad'], [1.075, 1.0, 0.54, 0, 'fern'],
    ];
    positions.forEach(([x, y, size, palette, kind], i) => {
      plants.push({ x: x * width, y: y * height, size: size * Math.min(width, height), sprite: sprites[palette][kind], phase: i * 1.7, kind, front: i >= 4 });
    });
    cache = { width, height, controlsHeight, back, plants, canopy, vines };
  }
  function plant(ctx, item, time) {
    ctx.save();ctx.translate(item.x, item.y);
    const seconds=time/1000;
    const flex=item.front ? .055 : .043;
    ctx.rotate(breeze(seconds,item.phase)*flex);
    ctx.transform(1,0,breeze(seconds-.7,item.phase)*flex*.6,1,0,0);
    const rootY=item.kind === 'fern' ? 400 : 410;
    ctx.drawImage(item.sprite, -item.size / 2, -item.size*rootY/420, item.size, item.size);
    ctx.restore();
  }
  function background(ctx, width, height, time, controlsHeight=0) {
    if (!cache || cache.width !== width || cache.height !== height || cache.controlsHeight !== controlsHeight) build(width, height,controlsHeight);
    const clock = reducedMotion.matches ? 0 : time;
    ctx.drawImage(cache.back, 0, 0);
    cache.vines.forEach(item=>vine(ctx,item,clock/1000));
    cache.canopy.forEach(item=>canopyLeaf(ctx,item,clock/1000));
    cache.plants.filter(p => !p.front).forEach(p => plant(ctx, p, clock));
    // Retain the floating mint and amber orbs, now with soft halos and slow drift.
    for (let i = 0; i < 42; i++) {
      const x = (((i * 83) % 997) / 997) * width + Math.sin(clock * 0.00017 + i) * 10;
      const y = height * (0.16 + ((i * 47) % 77) / 100) + Math.sin(clock * 0.0004 + i * 1.7) * 9;
      const radius = 1 + 1.5 * (0.5 + 0.5 * Math.sin(clock * 0.0012 + i));
      const amber = i % 4 === 0;
      glow(ctx, x, y, radius * 5, amber ? '#ffcf6e28' : '#8ef9d82d');
      ctx.fillStyle = amber ? '#f6d191' : '#a1eed5';
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(clock * 0.001 + i) ** 2;
      ctx.beginPath();ctx.arc(x, y, radius, 0, Math.PI * 2);ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function foreground(ctx, width, height, time, controlsHeight=0) {
    if (!cache || cache.width !== width || cache.height !== height || cache.controlsHeight !== controlsHeight) build(width, height,controlsHeight);
    cache.plants.filter(p => p.front).forEach(p => plant(ctx, p, reducedMotion.matches ? 0 : time));
    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.47, Math.min(width, height) * 0.22,
      width * 0.5, height * 0.47, Math.max(width, height) * 0.72);
    vignette.addColorStop(0, 'transparent');vignette.addColorStop(1, '#020e1a99');
    ctx.fillStyle = vignette;ctx.fillRect(0, 0, width, height);
  }
  return { background, foreground, breeze, vinePoint, groundY };
})();
