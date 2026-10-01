(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./motion') : root.SafariMotion);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AnimalRig = api;
})(globalThis, function(motion) {
  // Deform the continuous drawing around the feet: no rectangular leg cuts or lost facial pixels.
  const STRIDE = 38;
  function weights(rig, x, y) {
    return rig.feet.map(([hx, hy, fx, fy, radius]) => {
      const t = Math.max(0, Math.min(1, (y + rig.y - hy) / (fy - hy)));
      const axis = hx + (fx - hx) * t;
      return t * t * Math.exp(-Math.pow((x + rig.x - axis) / radius, 2) * 1.5);
    });
  }
  function create(rig, columns = 16, rows = 10) {
    const top = Math.min(...rig.feet.map(foot => foot[1])) - rig.y;
    const vertices = [];
    const triangles = [];
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
      const px = x * rig.width / columns, py = top + y * (rig.height - top) / rows;
      vertices.push({ x: px, y: py, weights: weights(rig, px, py) });
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const a = y * (columns + 1) + x, b = a + 1, c = a + columns + 1, d = c + 1;
      triangles.push([a,b,c], [b,d,c]);
    }
    return { vertices, triangles, top };
  }
  function deform(mesh, gait, movement = 1) {
    const steps = [0, .5, .16, .66].map(phase => motion.footstep(gait + phase, STRIDE, 15));
    return mesh.vertices.map(v => {
      let dx = 0, dy = 0, total = 0;
      v.weights.forEach((weight, i) => {
        dx += steps[i].x * weight; dy -= steps[i].lift * weight; total += weight;
      });
      return { x: v.x + dx * movement / Math.max(1,total), y: v.y + dy * movement / Math.max(1,total) };
    });
  }
  function draw(ctx, texture, rig, mesh, gait, movement) {
    const target = deform(mesh, gait, movement);
    const ratioX = texture.width / rig.width, ratioY = texture.height / rig.height;
    ctx.drawImage(texture,0,0,texture.width,mesh.top*ratioY,0,0,rig.width,mesh.top);
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
  return { STRIDE, create, deform, draw };
});
