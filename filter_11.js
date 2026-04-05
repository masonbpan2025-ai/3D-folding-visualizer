import fs from 'fs';

let text = fs.readFileSync('find_11.js', 'utf8');

const simulate = (treeObj) => {
    const I = () => [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
    const mul = (A, B) => {
        let C = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
        for(let i=0; i<4; i++) for(let j=0; j<4; j++) for(let k=0; k<4; k++) C[i][j] += A[i][k]*B[k][j];
        return C;
    };
    const trans = (x,y,z) => [[1,0,0,x],[0,1,0,y],[0,0,1,z],[0,0,0,1]];
    const rotZ = (a) => [[Math.cos(a), -Math.sin(a), 0, 0], [Math.sin(a), Math.cos(a), 0, 0], [0,0,1,0], [0,0,0,1]];
    const rotX = (a) => [[1,0,0,0], [0, Math.cos(a), -Math.sin(a), 0], [0, Math.sin(a), Math.cos(a), 0], [0,0,0,1]];
    
    let centers = [];
    const size = 1;
    const h = size * Math.sqrt(3)/2;
    const foldAngle = -Math.acos(1/3); 
    
    const traverse = (node, parentMat) => {
        let c = [0, 0, 0, 1];
        let wc = [0,0,0];
        for(let i=0; i<3; i++) for(let j=0; j<4; j++) wc[i] += parentMat[i][j] * c[j];
        centers.push(wc);
        
        for(let child of node.children) {
            let H = I();
            if(child.edge === 0) {
                H = trans(0, -h/3, 0);
            } else if(child.edge === 1) {
                H = mul(trans(size/4, h/12, 0), rotZ(Math.PI/3));
            } else if(child.edge === 2) {
                H = mul(trans(-size/4, h/12, 0), rotZ(-Math.PI/3));
            }
            H = mul(H, rotX(foldAngle));
            
            let cM = mul(H, trans(0, h/3, 0));
            // Child logic in visualizer: it's grouped so local edge 0 is rotated to match hinge!
            // WAIT! In my visualizer, the child Group is rotated by PI:
            // childSolid.rotation.z = Math.PI;
            cM = mul(cM, rotZ(Math.PI));
            
            traverse(child, mul(parentMat, cM));
        }
    };
    traverse(treeObj, I());
    
    for(let i=0; i<centers.length; i++){
        for(let j=i+1; j<centers.length; j++){
            let dx = centers[i][0] - centers[j][0];
            let dy = centers[i][1] - centers[j][1];
            let dz = centers[i][2] - centers[j][2];
            // Since distance between centers in octahedron is sqrt(2/3)*s? 
            // In a unit octahedron, opposite faces are distance sqrt(2/3), adjacent faces sqrt(1/3).
            // A distance < 0.1 definitively means centers are overlapping!
            if(Math.sqrt(dx*dx + dy*dy + dz*dz) < 0.1) return false;
        }
    }
    return true;
};

const N_U = [ [0,-1,1], [0,0,1], [-1,0,1] ];
const N_D = [ [0,1,0], [0,0,0], [1,0,0] ];
const getNeighbors = (u,v,up) => up===0 ? N_U.map(n=>({u:u+n[0], v:v+n[1], up:n[2]})) : N_D.map(n=>({u:u+n[0], v:v+n[1], up:n[2]}));
const normalize = (tris) => {
    let pts = tris.map(t => {
        let cx = t.u + 0.5 + 0.5*t.v;
        let cy = t.v + (t.up===0 ? 0.333333 : 0.666667);
        cx *= 10; cy *= 10 * Math.sqrt(3)/2;
        return {x: cx, y: cy};
    });
    let reps = [];
    for(let ref=0; ref<2; ref++) for(let a=0; a<6; a++){
            let cos = Math.cos(a*Math.PI/3), sin = Math.sin(a*Math.PI/3);
            let tp = pts.map(p => ({x: (ref?-p.x:p.x)*cos - p.y*sin, y: (ref?-p.x:p.x)*sin + p.y*cos}));
            let minx = Math.min(...tp.map(p=>p.x)), miny = Math.min(...tp.map(p=>p.y));
            reps.push(tp.map(p=>`${Math.round(p.x-minx)}_${Math.round(p.y-miny)}`).sort().join('|'));
    }
    return reps.sort()[0];
};

let shapes = new Set();
let nets = [];
let checked = new Set();
let q = [ [{u:0, v:0, up:0}] ];

while(q.length > 0){
    let cur = q.pop();
    if(cur.length === 8){
        let hash = normalize(cur);
        if(!shapes.has(hash)){
            shapes.add(hash);
            nets.push(cur);
        }
        continue;
    }
    let curSet = new Set(cur.map(t=>`${t.u}_${t.v}_${t.up}`));
    let adj = new Set();
    for(let t of cur) for(let n of getNeighbors(t.u, t.v, t.up)) {
        let k = `${n.u}_${n.v}_${n.up}`;
        if(!curSet.has(k)) adj.add(JSON.stringify(n));
    }
    for(let a of adj){
        let next = [...cur, JSON.parse(a)].sort((a,b)=>a.u-b.u || a.v-b.v || a.up-b.up);
        let nHash = next.map(t=>`${t.u}_${t.v}_${t.up}`).join('|');
        if(!checked.has(nHash)){ checked.add(nHash); q.push(next); }
    }
}

console.log("Total unique polyiamonds of size 8:", shapes.size); 
// There are 66 polyiamonds of size 8.

let validCounter = 0;
let out = "Object.assign(solids, {\n";
let colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#eab308', '#0d9488', '#059669', '#3b82f6'];

nets.forEach((net) => {
    // Generate tree format for ONE valid spanning tree
    let adj = Array(8).fill().map(()=>[]);
    let map = new Map();
    net.forEach((t, i) => map.set(`${t.u}_${t.v}_${t.up}`, i));
    
    for(let i=0; i<8; i++){
        let t = net[i];
        let neighs = getNeighbors(t.u, t.v, t.up);
        for(let d=0; d<3; d++){
            let n = neighs[d];
            if(map.has(`${n.u}_${n.v}_${n.up}`)) adj[i].push({to: map.get(`${n.u}_${n.v}_${n.up}`), stdEdge: d});
        }
    }
    
    let vis = new Set([0]);
    let treeNodes = [{ id: 0, node: { id: `O0`, color: colors[0], type: 'triangle', children: [] }, rot: 0 }];
    let q2 = [0];
    
    while(q2.length > 0){
        let curr = q2.pop();
        let currInfo = treeNodes.find(t=>t.id === curr);
        
        for(let {to: nIdx, stdEdge: d} of adj[curr]){ // d is standard grid local edge (0=Bot, 1=Right, 2=Left for Up(0). 0=Top, 1=Left, 2=Right for Down(1))
            if(!vis.has(nIdx)){
                vis.add(nIdx);
                // Node has absolute rotation `cRot` in 2D array.
                // Standard grid Angle in visualizer:
                // Up(0) has edges at: -90 (Bot=0), 30 (Right=1), 150 (Left=2).
                // Down(1) has edges at: 90 (Top=0), -150 (Left=1), -30 (Right=2).
                let cRot = currInfo.rot;
                let cUp = net[curr].up === 0;
                let stdAngle = cUp ? (d===0?-90 : d===1?30 : 150) : (d===0?90 : d===1?-150 : -30);
                
                // Which visualizer local edge index corresponds to `stdAngle` when rotated by `cRot`?
                // Visualizer edge angles (relative to parent): E0: -90, E1: 30, E2: 150.
                // Absolute visualizer angle = cRot + Visual_E.
                let visD = -1;
                for(let ve=0; ve<3; ve++){
                    let a = cRot + (ve===0?-90 : ve===1?30 : 150);
                    if( (a%360+360)%360 === (stdAngle%360+360)%360 ) { visD = ve; break; }
                }
                
                // Child bounds visual local edge 0 to parent's `visD`. 
                // In visual coordinate frame, edge bounding means angle rotates by 180 degrees.
                // Child's absolute rotation: parent angle `stdAngle` + 180.
                // And since Child's local 0 (which is -90) maps to this bonding interface, Child Rot - 90 = stdAngle + 180!
                // So Child Rot = stdAngle + 270.
                let nRot = stdAngle + 270;
                nRot = (nRot%360 + 360) % 360;
                
                let cNode = { id: `O${nIdx}`, color: colors[nIdx], type: 'triangle', edge: visD, foldAngle: -Math.acos(1/3), children: [] };
                currInfo.node.children.push(cNode);
                treeNodes.push({id: nIdx, node: cNode, rot: nRot});
                q2.push(nIdx);
            }
        }
    }
    
    let rootNode = treeNodes.find(t=>t.id===0).node;
    if(simulate(rootNode)) {
        validCounter++;
        out += `    oct_net_${validCounter}: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: ${JSON.stringify(rootNode).replace(/"([^(")"]+)":/g,"$1:")} },\n`;
    }
});

out += "});\n";
fs.writeFileSync('nets_to_implant.txt', out);
console.log(`Found ${validCounter} verified folding nets!`);
