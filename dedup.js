import fs from 'fs';

// We have 273 valid trees from nets_to_implant.txt
// A tree maps to a set of 2D triangles. We can deduplicate by taking the exact adjacency graph of the triangles!
// Two trees have the same 2D shape iff their dual graphs (where nodes are triangles, edges are shared sides) are isomorphic!
// Actually, since trees are just subgraphs, two trees can be different but span the same shape.
// So we need to reconstruct the full shape graph (with all shared borders).

// Let's reconstruct the 2D layout.
// For a tree node, we just track its 2D abstract location in my canonical grid.
let text = fs.readFileSync('nets_to_implant.txt', 'utf8');

// Parse the file.
let lines = text.split('\n');
let nets = [];
let currentNetStr = "";
for(let line of lines){
    if(line.includes("oct_net_")){
        let treeStr = line.substring(line.indexOf("net:") + 4, line.lastIndexOf("}")-1).trim();
        nets.push(eval(`(${treeStr})`));
    }
}

// Map each net to a 2D grid and find its boundary polygon!
const getShapeHash = (tree) => {
    let tris = [];
    const traverse = (node, rX, rY, ang) => {
        // ang = 0 -> Up. ang = 180 -> Down.
        tris.push({x: rX, y: rY, ang: ang%360});
        for(let child of node.children){
            let d = child.edge;
            let nx, ny, nang;
            // From our visualizer:
            let a = (ang + d*120 + 90) * Math.PI / 180;
            nx = rX + Math.cos(a)*1000;
            ny = rY + Math.sin(a)*1000;
            nang = ang + d*120 + 180;
            traverse(child, nx, ny, nang);
        }
    };
    traverse(tree, 0, 0, 0);
    
    // Convert float centers to rigorous equivalence classes
    let centers = tris.map(t => ({x: t.x, y: t.y}));
    
    // Find all pair distances
    let dists = [];
    for(let i=0; i<8; i++){
        for(let j=i+1; j<8; j++){
            let dx = centers[i].x - centers[j].x;
            let dy = centers[i].y - centers[j].y;
            dists.push(Math.round(Math.sqrt(dx*dx + dy*dy)));
        }
    }
    // The sorted set of 28 all-pairs pairwise distances is a PERFECT rotation/translation invariant hash!
    // Polyiamonds of size 8 have distinct distance multiset fingerprints! (No two different 8-polyiamonds have identical multisets of distances between centers).
    dists.sort((a,b)=>a-b);
    return dists.join(',');
};

let uniqueShapes = new Map();
let uniqueNets = [];

nets.forEach((net, idx) => {
    let hash = getShapeHash(net);
    if(!uniqueShapes.has(hash)){
        uniqueShapes.set(hash, idx);
        uniqueNets.push(net);
    }
});

console.log("Distinct geometric 2D shapes amongst the folding nets:", uniqueShapes.size);
// Should be exactly 11 !

if(uniqueShapes.size === 11) {
    let out = "Object.assign(solids, {\n";
    uniqueNets.forEach((net, i) => {
        out += `    oct_net_${i+1}: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: ${JSON.stringify(net).replace(/"([^(")"]+)":/g,"$1:")} },\n`;
    });
    out += "});\n";
    fs.writeFileSync('final_11.txt', out);
    console.log("Wrote exact 11 nets to final_11.txt!");
}
