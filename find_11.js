import fs from 'fs';

// 1. Generate the 11 octiamonds on the integer grid that have max vertex degree 4 and no cut vertices.
// Actually, an octiamond folds into an octahedron iff max vertex degree <= 4 AND no "holes". For N=8 there are no holes.
// So exactly the 11 octiamonds with max vertex degree <= 4 are the octahedron nets!

const N_U = [ [0,-1,1], [0,0,1], [-1,0,1] ];
const N_D = [ [0,1,0], [0,0,0], [1,0,0] ];

const getNeighbors = (u,v,up) => up===0 ? N_U.map(n=>({u:u+n[0], v:v+n[1], up:n[2]})) : N_D.map(n=>({u:u+n[0], v:v+n[1], up:n[2]}));

let shapes = new Set();
let nets = [];

const normalize = (tris) => {
    // tris is array of {u, v, up}
    // Convert to cubic coords: a triangle is defined by its 3 vertices in (x,y,z) Z^3, x+y+z=0 or 1.
    // Simpler: use 2D euclidean centers
    let pts = tris.map(t => {
        let cx = t.u + 0.5 + 0.5*t.v;
        let cy = t.v + (t.up===0 ? 0.333333 : 0.666667);
        cx *= 10; cy *= 10 * Math.sqrt(3)/2;
        return {x: cx, y: cy};
    });
    
    let reps = [];
    for(let ref=0; ref<2; ref++){
        for(let a=0; a<6; a++){
            let cos = Math.cos(a*Math.PI/3), sin = Math.sin(a*Math.PI/3);
            let tp = pts.map(p => {
                let x = ref ? -p.x : p.x;
                let y = p.y;
                return {x: x*cos - y*sin, y: x*sin + y*cos};
            });
            let minx = Math.min(...tp.map(p=>p.x)), miny = Math.min(...tp.map(p=>p.y));
            reps.push(tp.map(p=>`${Math.round(p.x-minx)}_${Math.round(p.y-miny)}`).sort().join('|'));
        }
    }
    return reps.sort()[0];
};

const getMaxDegree = (tris) => {
    let deg = {};
    for(let t of tris){
        // Vertices of Up(u,v): (u,v), (u+1,v), (u,v+1)
        // Down(u,v): (u+1,v), (u+1,v+1), (u,v+1)
        let vs = t.up===0 ? [[t.u,t.v], [t.u+1,t.v], [t.u,t.v+1]] : [[t.u+1,t.v], [t.u+1,t.v+1], [t.u,t.v+1]];
        for(let v of vs){
            let k = `${v[0]}_${v[1]}`;
            deg[k] = (deg[k]||0)+1;
        }
    }
    return Math.max(...Object.values(deg));
};

// DFS all polyiamonds of size 8
let q = [ [{u:0, v:0, up:0}] ];
let checked = new Set();
while(q.length > 0){
    let cur = q.pop();
    if(cur.length === 8){
        if(getMaxDegree(cur) <= 4){
            let hash = normalize(cur);
            if(!shapes.has(hash)){
                shapes.add(hash);
                nets.push(cur);
            }
        }
        continue;
    }
    
    let curSet = new Set(cur.map(t=>`${t.u}_${t.v}_${t.up}`));
    let adj = new Set();
    for(let t of cur){
        for(let n of getNeighbors(t.u, t.v, t.up)){
            let k = `${n.u}_${n.v}_${n.up}`;
            if(!curSet.has(k)) adj.add(JSON.stringify(n));
        }
    }
    for(let a of adj){
        let cand = JSON.parse(a);
        let next = [...cur, cand].sort((a,b)=>a.u-b.u || a.v-b.v || a.up-b.up);
        let nHash = next.map(t=>`${t.u}_${t.v}_${t.up}`).join('|');
        if(!checked.has(nHash)){
            checked.add(nHash);
            q.push(next);
        }
    }
}

console.log(`Found exactly ${nets.length} 2D octiamonds with max degree <= 4!`); 
// It should be 11.

if(nets.length === 11){
    // Unroll them into the Visualizer tree layout!
    // We already established the Face Tracker provides the exact topological connections to map 2D -> 3D tree.
    // For a given valid octiamond, ANY spanning tree of its faces mapped via 3D tracking yields a valid layout!
    // But since visualizer's children bind their local 0 to parent's d...
    // The safest way is to output a custom build function for each net that manually positions them!
    // wait, buildNet is fixed.
    
    // Instead of using generic trees, output visualizer JSON!
    let out = "Object.assign(solids, {\n";
    let colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#eab308', '#0d9488', '#059669', '#3b82f6'];
    
    nets.forEach((net, idx) => {
        // Build a spanning tree
        let adj = Array(8).fill().map(()=>[]);
        let map = new Map();
        net.forEach((t, i) => map.set(`${t.u}_${t.v}_${t.up}`, i));
        
        for(let i=0; i<8; i++){
            let t = net[i];
            let neighs = getNeighbors(t.u, t.v, t.up);
            for(let d=0; d<3; d++){
                let n = neighs[d];
                let k = `${n.u}_${n.v}_${n.up}`;
                if(map.has(k)) {
                    adj[i].push({to: map.get(k), grid_edge: d});
                }
            }
        }
        
        // Find a spanning tree. 
        // We know visualizer expects parent-child relationships with `edge` index relative to PARENT.
        // Wait, the Visualizer builds an arbitrary tree.
        // But the Visualizer's `d` refers to the visualizer's geometry, which rotates children.
        // If we want Visualizer to fold it into an octahedron, we MUST map the 2D grid spanning tree into Visualizer's rotation-aware tree!
        // Visualizer local edges: 0(Bottom), 1(Right Slant), 2(Left Slant).
        // Let's track absolute rotation of nodes in Visualizer!
        
        let vis = new Set([0]);
        let treeNodes = [{ id: 0, visNode: { id: `O${idx}_0`, color: colors[0], type: 'triangle', children: [] }, rot: 0 }];
        let q = [0];
        
        while(q.length > 0){
            let curr = q.pop();
            let currNodeInfo = treeNodes.find(t=>t.id === curr);
            let cRot = currNodeInfo.rot; // absolute rotation in visualizer 2D plane
            
            for(let {to: nIdx, grid_edge: d} of adj[curr]){ // d is 0,1,2 in STANDARD grid
                if(!vis.has(nIdx)){
                    vis.add(nIdx);
                    
                    // What is standard grid `d` in the visualizer's rotated frame?
                    // In standard grid, Edges of Up: 0(Bottom, angle -90), 1(Right, angle 30), 2(Left, angle 150)
                    // If node is rotated by `cRot`, visualizer local edge `vd` has angle: `cRot + (vd===0?-90 : vd===1?30 : 150)`.
                    // And standard edge `d` has angle `(cRot%360)`? No, standard grid is static. 
                    // Assume standard Up(0) has rot=0. Its edge angles are -90, 30, 150.
                    // If visualizer node has rot `cRot`, its visual local edge `vd` maps to absolute angle `A = cRot + (vd===0?-90 : vd===1?30 : 150)`.
                    // Standard edge `d` has absolute angle `B = (net[curr].up === 0 ? (d===0?-90 : d===1?30 : 150) : (d===0?90 : d===1?210 : d===2?-30))`.
                    let isUp = net[curr].up === 0;
                    let B = isUp ? (d===0?-90 : d===1?30 : 150) : (d===0?90 : d===1?210 : -30);
                    
                    // We need to find the visualizer local edge `vd` (0,1,2) that aligns with absolute angle `B`.
                    let vd = -1;
                    for(let candidate=0; candidate<3; candidate++){
                        let A = cRot + (candidate===0?-90 : candidate===1?30 : 150);
                        if( ((A%360 + 360)%360) === ((B%360 + 360)%360) ){
                            vd = candidate; break;
                        }
                    }
                    
                    if(vd === -1) throw new Error("Could not map visualizer edge!");
                    
                    // Child in visualizer is rotated such that its local Edge 0 is bonded to Parent's `vd`.
                    // So child's absolute rotation becomes `A + 180 - (-90) = A + 270`.
                    let childRot = cRot + (vd===0?-90 : vd===1?30 : 150) + 270;
                    childRot = (childRot%360 + 360) % 360;
                    
                    let childNode = { id: `O${idx}_${nIdx}`, color: colors[nIdx], type: 'triangle', edge: vd, foldAngle: -Math.acos(1/3), children: [] };
                    currNodeInfo.visNode.children.push(childNode);
                    treeNodes.push({id: nIdx, visNode: childNode, rot: childRot});
                    q.push(nIdx);
                }
            }
        }
        
        let netObj = treeNodes.find(t=>t.id===0).visNode;
        out += `    oct_net_${idx+1}: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: ${JSON.stringify(netObj).replace(/"([^(")"]+)":/g,"$1:")} },\n`;
    });
    out += "});\n";
    fs.writeFileSync('generated_nets.js', out);
}

