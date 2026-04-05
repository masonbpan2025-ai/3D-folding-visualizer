import fs from 'fs';
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
        if(child.edge === 0) H = trans(0, -h/3, 0);
        else if(child.edge === 1) H = mul(trans(size/4, h/12, 0), rotZ(Math.PI/3));
        else if(child.edge === 2) H = mul(trans(-size/4, h/12, 0), rotZ(-Math.PI/3));
        H = mul(H, rotX(foldAngle));
        let cM = mul(H, trans(0, h/3, 0));
        cM = mul(cM, rotZ(Math.PI));
        traverse(child, mul(parentMat, cM));
    }
};

const checkCollapse = (tree) => {
    centers = [];
    traverse(tree, I());
    for(let i=0; i<centers.length; i++){
        for(let j=i+1; j<centers.length; j++){
            let dx = centers[i][0] - centers[j][0];
            let dy = centers[i][1] - centers[j][1];
            let dz = centers[i][2] - centers[j][2];
            if(Math.sqrt(dx*dx + dy*dy + dz*dz) < 0.1) return false;
        }
    }
    return true;
};

// Generate 11 Cube trees
const edges = [];
for(let i=0; i<8; i++){
    for(let j=i+1; j<8; j++){
        let d = i^j;
        if(d===1) edges.push([i,j,0]);
        if(d===2) edges.push([i,j,1]);
        if(d===4) edges.push([i,j,2]);
    }
}

let allTrees = [];
const getTrees = (edgeIdx, currentTree) => {
    if(currentTree.length === 7){
        let adj = Array(8).fill(0).map(()=>[]);
        for(let e of currentTree){
            adj[e[0]].push(e[1]); adj[e[1]].push(e[0]);
        }
        let vis = new Set([0]);
        let q = [0];
        while(q.length > 0){
            let cur = q.pop();
            for(let n of adj[cur]) if(!vis.has(n)){ vis.add(n); q.push(n); }
        }
        if(vis.size === 8) allTrees.push(currentTree);
        return;
    }
    if(edgeIdx >= edges.length) return;
    getTrees(edgeIdx+1, [...currentTree, edges[edgeIdx]]);
    getTrees(edgeIdx+1, currentTree);
};
getTrees(0, []); 

let perms = [ [0,1,2], [0,2,1], [1,0,2], [1,2,0], [2,0,1], [2,1,0] ];
let syms = [];
for(let p of perms){
    for(let f=0; f<8; f++){
        syms.push((v) => {
            let bits = [v&1, (v>>1)&1, (v>>2)&1];
            let nb = [bits[p[0]]^((f)&1), bits[p[1]]^((f>>1)&1), bits[p[2]]^((f>>2)&1)];
            return nb[0] | (nb[1]<<1) | (nb[2]<<2);
        });
    }
}

let classes = [];
let seen = new Set();
for(let t of allTrees){
    let best = null;
    for(let sym of syms){
        let mapped = t.map((e) => {
            let mu = sym(e[0]), mv = sym(e[1]);
            if(mu > mv) { let tmp = mu; mu = mv; mv = tmp; }
            return (mu<<4) | mv;
        });
        mapped.sort((a,b)=>a-b);
        let h = mapped.join('-');
        if(best === null || h < best) best = h;
    }
    if(!seen.has(best)){
        seen.add(best);
        classes.push(t);
    }
}

console.log("Found cube trees:", classes.length); // Should be 11

let visualizerNets = [];
let colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#eab308', '#0d9488', '#059669', '#3b82f6'];

classes.forEach((tree, idx) => {
    let adj = Array(8).fill(0).map(()=>[]);
    for(let e of tree){
        adj[e[0]].push({to:e[1], bit:e[2]});
        adj[e[1]].push({to:e[0], bit:e[2]});
    }
    
    // Convert to Visualizer format using exact state swaps
    let vis = new Set([0]);
    
    const buildNode = (u, state) => {
        let res = { id: `O${idx}_${u}`, type: 'triangle', color: colors[u], children: [] };
        
        for(let {to:v, bit:b} of adj[u]){
            if(!vis.has(v)){
                vis.add(v);
                
                // Which visualizer local edge (0,1,2) corresponds to flipping bit `b`?
                // The current visualizer node maps its local edges [0, 1, 2] to bits `state[0]`, `state[1]`, `state[2]`.
                let visualEdge = state.indexOf(b);
                if(visualEdge === -1) throw new Error("Bit not found in state!");
                
                // When we attach the child on visualEdge `vd`, its state is rotated and flipped.
                let nState;
                if(visualEdge === 0) nState = [state[0], state[2], state[1]];
                if(visualEdge === 1) nState = [state[2], state[1], state[0]];
                if(visualEdge === 2) nState = [state[1], state[0], state[2]];
                
                let child = buildNode(v, nState);
                child.edge = visualEdge;
                child.foldAngle = -Math.acos(1/3);
                res.children.push(child);
            }
        }
        return res;
    };
    
    vis.add(0);
    let net = buildNode(0, [0, 1, 2]); // Initial mapping: Visual Edge 0->Bit 0, Edge 1->Bit 1, Edge 2->Bit 2.
    if(checkCollapse(net)){
        visualizerNets.push(net);
    } else {
        console.log("Overlap in class", idx);
    }
});

console.log("Successfully mapped non-overlapping visualizer nets:", visualizerNets.length);
if(visualizerNets.length === 11){
    let out = "Object.assign(solids, {\n";
    visualizerNets.forEach((net, i) => {
        out += `    oct_net_${i+1}: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: ${JSON.stringify(net).replace(/"([^(")"]+)":/g,"$1:")} },\n`;
    });
    out += "});\n";
    fs.writeFileSync('inject_nets.js', out);
}
