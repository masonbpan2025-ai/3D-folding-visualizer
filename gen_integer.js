import fs from 'fs';

let validNets = [];
let seenShapes = new Set();
    
// We use (u, v, up) grid representation. up=0, down=1.
// Local edges for Up (0):
// 0(Bottom) -> (u, v-1, 1)
// 1(Right)  -> (u+1, v-1, 1)  wait.
// Let's verify standard integer grid for up/down triangles.
// Let Up = (u,v,0). Vertices: (u,v), (u+1,v), (u,v+1).
// Center is u + 0.5 + 0.5*v, v * sqrt(3)/2. Wait, no.
// If basis is e1=(1,0), e2=(0.5, sqrt(3)/2)...
// V0=(u,v), V1=(u+1,v), V2=(u,v+1).
// Edges of Up(u,v,0):
// 0(Bottom): connects V0,V1. Belongs to Down(u, v-1, 1). Its vertices are (u+1,v-1), (u+1,v), (u,v). Matches V0,V1 perfectly!
// 1(Right slant): connects V1,V2. Belongs to Down(u, v, 1). Its vertices are (u+1,v), (u+1,v+1), (u,v+1). Matches V1,V2 perfectly!
// 2(Left slant): connects V2,V0. Belongs to Down(u-1, v, 1). Its vertices are (u,v), (u,v+1), (u-1,v+1). Matches V2,V0 perfectly!
const N_D = [
    [ [0,-1,1], [0,0,1], [-1,0,1] ], // Neighbors of Up(0) for edge 0,1,2
    [ [0,1,0], [0,0,0], [1,0,0] ]    // Neighbors of Down(1) for edge 0,1,2 (Top, Left, Right)
];

const getCoords = (treeStr) => {
    let tree = eval(`(${treeStr})`);
    let coords = [{u:0, v:0, o:0}];
    let map = new Set(["0_0_0"]);
    let edges = []; // tracking local edge connections
    
    // In our visualizer, child is ALWAYS rotated such that its local Edge 0 bonds to Parent's Edge d.
    // For Up parent -> Child is Down. Its local 0 corresponds to Top. So it uses N_D[1][0] to bond back!
    // So if Parent bonds on 0, child is placed at n=N_D[0][0]. Child's Edge 1, 2 = local Left, Right = N_D[1][1], N_D[1][2].
    // If Parent bonds on 1 (Right Slant), child is Down. BUT visualizer rotates child so Child's Edge 0 bonds to Parent's Edge 1.
    // In standard grid, Parent's Edge 1 bonds to Down(u,v,1) Top-Left edge. Top-Left edge of Down is N_D[1][1].
    // So visualizer's rotation is effectively re-indexing the child's local edges!
    const addNode = (n, pu, pv, po) => {
        for(let c of n.children){
            let d = c.edge;
            let no, nu, nv;
            // Visualizer generic math mappings without floating points:
            // Just use the Face-Vertex tracker to get topological structure, and output it directly!
        }
    };
    return {coords, map};
};

let classes = [];

// To bypass 2D spatial layouts during generation, just use topological face tracking:
const search = (nodeStrTpl, numNodes, availSlots, facesSet, currentTreeEdges) => {
    if(numNodes === 8){
        let tree = eval(`(${nodeStrTpl})`);
        
        // Convert to Graph to find degree
        let degree = Array(8).fill(0);
        for(let e of currentTreeEdges){
            degree[e.u]++; degree[e.v]++;
        }
        
        let hash = [...facesSet].sort().join('|');
        if(!seenShapes.has(hash)){
            seenShapes.add(hash);
            validNets.push(tree);
        }
        return;
    }

    // Pick slot in a specific order to avoid duplicates? No, just pick first slot to build tree
    // Actually, picking first slot generates a subset of shapes (only caterpillars).
    // We must try expanding from ANY available slot!
    for(let i=0; i<availSlots.length; i++){
        let slot = availSlots[i];
        let state = slot.state;
        let d = slot.edge;
        
        let nState = [...state];
        nState[d] = -state[d]; // flip the vertex opposite to edge d! In state=[V0(bot), V1(right), V2(left)].
        // Wait, earlier I said:
        // Child's local Edge 0 is bonded to Parent Edge d.
        // So Child's Vert0 is the flipped vertex! child_V0 = -parent_Vd.
        // What about Child's Edge 1 and 2?
        // Let's abstract this away:
        // The child's Vertices are [-Vd, V(d+2)%3, V(d+1)%3].
        if(d===0) nState = [-state[0], state[2], state[1]];
        if(d===1) nState = [-state[1], state[0], state[2]];
        if(d===2) nState = [-state[2], state[1], state[0]];
        
        let faceStr = [...nState].sort((a,b) => Math.abs(a)-Math.abs(b)).map(Math.sign).join('');
        if(!facesSet.has(faceStr)){
            let nFaces = new Set(facesSet);
            nFaces.add(faceStr);
            
            let nSlots = [...availSlots];
            nSlots.splice(i, 1);
            
            let childId = numNodes;
            let nEdges = [...currentTreeEdges, {u: slot.parentId, v: childId}];
            let cStr = `{ id: 'O_${childId}', edge: ${d}, type:'triangle', children: [] }`;
            let nTpl = nodeStrTpl.replace(`/*SLOT_${slot.id}*/`, cStr + `, /*SLOT_${childId}_new*/ /*SLOT_${slot.id}*/`);
            let nTpl2 = nTpl.replace(`/*SLOT_${childId}_new*/`, `/*SLOT_C${childId}_1*/ /*SLOT_C${childId}_2*/`);
            
            nSlots.push({ id: `C${childId}_1`, parentId: childId, edge: 1, state: nState });
            nSlots.push({ id: `C${childId}_2`, parentId: childId, edge: 2, state: nState });
            
            search(nTpl2, numNodes+1, nSlots, nFaces, nEdges);
        }
    }
};

let rootState = [1, 2, 3];
let slots = [
    { id: 'R_0', parentId: 0, edge: 0, state: rootState },
    { id: 'R_1', parentId: 0, edge: 1, state: rootState },
    { id: 'R_2', parentId: 0, edge: 2, state: rootState }
];
let rootTpl = `{ id: 'O_0', type: 'triangle', children: [ /*SLOT_R_0*/ /*SLOT_R_1*/ /*SLOT_R_2*/ ] }`;
let initFaces = new Set([[...rootState].sort((a,b)=>Math.abs(a)-Math.abs(b)).map(Math.sign).join('')]);

search(rootTpl, 1, slots, initFaces, []);

console.log("Total unique nets found:", validNets.length);

let output = "const generated_nets = {\n";
validNets.forEach((net, i) => {
    let colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#eab308', '#0d9488', '#059669', '#3b82f6'];
    let cidx = 0;
    const cleanTree = (n) => {
        let res = { id: n.id, type: n.type, color: colors[parseInt(n.id.split('_')[1])], children: [] };
        if(n.edge !== undefined) res.edge = n.edge;
        for(let c of n.children) if(c.id) res.children.push(cleanTree(c));
        return res;
    };
    output += `    oct_net_${i+1}: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: ${JSON.stringify(cleanTree(net)).replace(/"([^(")"]+)":/g,"$1:")} },\n`;
});
output += "};\n";
fs.writeFileSync('generated_nets.js', output);
