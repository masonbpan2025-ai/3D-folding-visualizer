import fs from 'fs';

const N = [
    [ [0, -1, 1], [1, 0, 1], [-1, 0, 1] ], // Up (0)
    [ [0, 1, 0], [-1, 0, 0], [1, 0, 0] ]   // Down (1)
];

const getCenters = (tris) => {
    return tris.map(t => {
        let rx = t.x + 0.5 * t.y;
        let ry = t.y * Math.sqrt(3)/2;
        let cy = t.o === 0 ? Math.sqrt(3)/6 : Math.sqrt(3)/3;
        // The center of the triangle relies on o
        let cx = t.x + 0.5 + 0.5 * t.y; 
        // Wait, precise center is not strictly necessary as long as the 3 vertices are correct.
        // Let's just use the vertices!
        return {x: t.x, y: t.y, o: t.o};
    });
};

const normalize = (tris) => {
    // Return lexicographically smallest normalized vertices
    let v_sets = [];
    let base_centers = tris.map(t => {
        let cx = t.x + 0.5;
        let cy = t.y + (t.o === 0 ? 1/3.0 : 2/3.0);
        let rx = cx + 0.5 * cy;
        let ry = cy * Math.sqrt(3)/2;
        return {x: rx, y: ry};
    });
    
    let reps = [];
    for(let r=0; r<2; r++){
        for(let a=0; a<6; a++){
            let theta = a * Math.PI / 3;
            let cos = Math.cos(theta), sin = Math.sin(theta);
            let trans = base_centers.map(c => {
                let x = c.x, y = c.y;
                if(r) x = -x;
                return {
                    x: Math.round((x*cos - y*sin)*1000)/1000,
                    y: Math.round((x*sin + y*cos)*1000)/1000
                };
            });
            let minx = Math.min(...trans.map(c=>c.x));
            let miny = Math.min(...trans.map(c=>c.y));
            let norm = trans.map(c => `${(c.x-minx).toFixed(3)}_${(c.y-miny).toFixed(3)}`).sort().join('|');
            reps.push(norm);
        }
    }
    return reps.sort()[0];
};

const getMaxDegree = (tris) => {
    let vcount = {};
    const addV = (vx, vy) => {
        let key = `${vx}_${vy}`;
        vcount[key] = (vcount[key]||0) + 1;
    };
    for(let t of tris){
        if(t.o === 0){
            addV(t.x, t.y); addV(t.x+1, t.y); addV(t.x, t.y+1);
        } else {
            addV(t.x+1, t.y); addV(t.x+1, t.y+1); addV(t.x, t.y+1);
        }
    }
    return Math.max(...Object.values(vcount));
};

let shapes = new Map();

const search = (current) => {
    if(current.length === 8){
        if(getMaxDegree(current) <= 4){
            let hash = normalize(current);
            if(!shapes.has(hash)){
                shapes.set(hash, current);
            }
        }
        return;
    }
    
    // Find all adjacent positions
    let adj = new Set();
    let has = new Set(current.map(t => `${t.x}_${t.y}_${t.o}`));
    
    for(let t of current){
        let neigh = N[t.o];
        for(let d=0; d<3; d++){
            let nx = t.x + neigh[d][0];
            let ny = t.y + neigh[d][1];
            let no = neigh[d][2];
            let k = `${nx}_${ny}_${no}`;
            if(!has.has(k)) adj.add(JSON.stringify({x: nx, y: ny, o: no}));
        }
    }
    
    for(let a of adj){
        let cand = JSON.parse(a);
        let next = [...current, cand];
        // Enforce ordering to avoid redundant permutations (simple optimization)
        // just ensure the new node is lexicographically larger than the last node
        let last = current[current.length-1];
        if (cand.x > last.x || (cand.x === last.x && cand.y > last.y) || (cand.x === last.x && cand.y === last.y && cand.o > last.o)) {
            search(next);
        }
    }
};

search([{x: 0, y: 0, o: 0}]);
console.log("Unique valid shapes:", shapes.size);

// Now, for each shape, find a spanning tree and generate the JS string
let jsOut = "";

let id_counter = 1;

for(let [hash, shape] of shapes.entries()){
    let edges = []; // adj list
    let has = new Map();
    for(let i=0; i<8; i++){
        has.set(`${shape[i].x}_${shape[i].y}_${shape[i].o}`, i);
    }
    
    let adj = Array(8).fill(0).map(()=>[]);
    for(let i=0; i<8; i++){
        let t = shape[i];
        let neigh = N[t.o];
        for(let d=0; d<3; d++){
            let nx = t.x + neigh[d][0];
            let ny = t.y + neigh[d][1];
            let no = neigh[d][2];
            let k = `${nx}_${ny}_${no}`;
            if(has.has(k)){
                let j = has.get(k);
                adj[i].push({to: j, dir: d});
            }
        }
    }
    
    // DFS for spanning tree
    let visited = new Set();
    let root = 0;
    visited.add(0);
    
    const buildTree = (u) => {
        let nodeStr = `{ id: 'T_${id_counter}_${u}', label: '', color: '#38bdf8', children: [`;
        let childStrs = [];
        for(let edge of adj[u]){
            let v = edge.to;
            if(!visited.has(v)){
                visited.add(v);
                let childNodeStr = buildTree(v);
                childStrs.push(`{ edge: ${edge.dir}, node: ${childNodeStr} }`);
            }
        }
        if(childStrs.length > 0){
            nodeStr += childStrs.map(c => ` Object.assign({}, ${c.node}, {edge: ${c.edge}}) `).join(', ');
        }
        nodeStr += `]}`;
        return nodeStr;
    };
    
    let treeStr = buildTree(0);
    jsOut += `    oct_net_${id_counter}: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: ${treeStr} },\n`;
    id_counter++;
}

fs.writeFileSync('nets.js', jsOut);
console.log("Done writing nets.js");
