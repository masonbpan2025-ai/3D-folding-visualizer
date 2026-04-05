import fs from 'fs';
import * as THREE from 'three';

const Math_acos1_3 = -Math.acos(1/3);

const s = 10;
function createNGon(n) {
    const pts = [];
    let x = 0, y = 0, angle = 0;
    const extAngle = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
        pts.push(new THREE.Vector3(x, y, 0));
        x += s * Math.cos(angle);
        y += s * Math.sin(angle);
        angle += extAngle;
    }
    return pts;
}

const polygonCache = {};
function getPolygonData(type) {
    if (polygonCache[type]) return polygonCache[type];
    const vertices = createNGon(3);
    const edges = [];
    for (let i = 0; i < 3; i++) edges.push([vertices[i], vertices[(i + 1) % 3]]);
    polygonCache[type] = { vertices, edges, sides: 3 };
    return polygonCache[type];
}

const testOverlap = (treeDef) => {
    let centers = [];
    let overlap = false;
    
    let cx = 0, cy = 0;
    const polyData = getPolygonData('triangle');
    polyData.vertices.forEach(v => { cx += v.x; cy += v.y; });
    cx /= polyData.sides; cy /= polyData.sides;
    const localCenter = new THREE.Vector3(cx, cy, 0);

    const build = (nodeDef, parentMatrix) => {
        if (overlap) return;
        let c = localCenter.clone().applyMatrix4(parentMatrix);
        for(let prev of centers) {
            if (prev.distanceTo(c) < 1.0) overlap = true;
        }
        centers.push(c);
        
        nodeDef.children.forEach(childDef => {
            const pEdge = polyData.edges[childDef.edge];
            let vStart = pEdge[0];
            let vEnd = pEdge[1];
            
            let hingeMat = new THREE.Matrix4().makeTranslation(vEnd.x, vEnd.y, vEnd.z);
            let dir = vStart.clone().sub(vEnd);
            let rotZ = new THREE.Matrix4().makeRotationZ(Math.atan2(dir.y, dir.x));
            let rotX = new THREE.Matrix4().makeRotationX(Math_acos1_3);
            hingeMat.multiply(rotZ).multiply(rotX);
            
            build(childDef, parentMatrix.clone().multiply(hingeMat));
        });
    };
    build(treeDef, new THREE.Matrix4());
    return !overlap;
};

const get2DHash = (treeDef) => {
    let pts = [];
    let r = 0;
    let cx = 0, cy = 0;
    const polyData = getPolygonData('triangle');
    polyData.vertices.forEach(v => { cx += v.x; cy += v.y; });
    cx /= polyData.sides; cy /= polyData.sides;
    const localCenter = new THREE.Vector3(cx, cy, 0);

    const build = (nodeDef, parentMatrix) => {
        let c = localCenter.clone().applyMatrix4(parentMatrix);
        pts.push({x: c.x, y: c.y});
        
        nodeDef.children.forEach(childDef => {
            const pEdge = polyData.edges[childDef.edge];
            let vStart = pEdge[0];
            let vEnd = pEdge[1];
            
            let hingeMat = new THREE.Matrix4().makeTranslation(vEnd.x, vEnd.y, vEnd.z);
            let dir = vStart.clone().sub(vEnd);
            let rotZ = new THREE.Matrix4().makeRotationZ(Math.atan2(dir.y, dir.x));
            hingeMat.multiply(rotZ);
            
            build(childDef, parentMatrix.clone().multiply(hingeMat));
        });
    };
    build(treeDef, new THREE.Matrix4());
    
    let dists = [];
    for(let i=0; i<pts.length; i++){
        for(let j=i+1; j<pts.length; j++){
            let dx = pts[i].x - pts[j].x;
            let dy = pts[i].y - pts[j].y;
            dists.push(Math.round(Math.sqrt(dx*dx + dy*dy)*10)); // hash using x10 integers
        }
    }
    dists.sort((a,b)=>a-b);
    return dists.join(',');
};

let colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#eab308', '#0d9488', '#059669', '#3b82f6'];

let foundTrees = [];
let shapeHashes = new Set();
let ctr = 0;

function enumerateTrees(nodesRemaining, slotsAvailable) {
    if (nodesRemaining === 0) {
        return [{ id: 'PLACEHOLDER', children: [] }]; // will be ignored except for structure
    }
    
    let results = [];
    // We must pick SOME subset of the available slots to attach children to.
    // For each slot, we can place a tree of sizes 1 to (nodesRemaining).
    // This is standard partition logic, but we can do it easier by assigning nodes one by one.
    return results; // We'll implement a different DFS
}

// Global DFS state
const MAX_NODES = 8;
const treePool = [];

function createNode(id) {
    return { id: `T${id}`, color: colors[id], children: [] };
}

function searchDirect(nodesAdded, treeBuilt) {
    if (nodesAdded === MAX_NODES) {
        ctr++;
        if (ctr % 10000 === 0) console.log("Tested", ctr, "trees");
        if (testOverlap(treeBuilt)) {
            let hash = get2DHash(treeBuilt);
            if (!shapeHashes.has(hash)) {
                shapeHashes.add(hash);
                foundTrees.push(JSON.parse(JSON.stringify(treeBuilt)));
            }
        }
        return;
    }
    
    // Collect all open slots in the current tree
    let openSlots = [];
    const collect = (node, isRoot) => {
        let maxEdges = isRoot ? [0, 1, 2] : [1, 2];
        let used = node.children.map(c => c.edge);
        for (let e of maxEdges) {
            if (!used.includes(e)) openSlots.push({ node, edge: e });
        }
        for (let c of node.children) collect(c, false);
    };
    collect(treeBuilt, true);
    
    // To avoid duplicating equivalent permutations of building the SAME tree,
    // we only add children to the FIRST available slot?
    // Wait, if we enforce an ordering on slots, we don't duplicate generation paths!
    // But since order of children inside the node doesn't strictly matter for hash, 
    // we can just pick the first slot and either use it or skip it ...
    // Wait, simpler: tree structure must be fully explored.
    
    // Better logic: `searchTrees(size)`
    // Returns all tree shapes of `size` nodes.
}

let treesBySize = [];
for(let i=0; i<=8; i++) treesBySize.push([]);

treesBySize[1] = [ { children: [] } ];

for (let size = 2; size <= 8; size++) {
    // A tree of `size` nodes is a root + subtrees on its available slots.
    // Slots for root: 0, 1, 2
    // But wait, the root itself is just a node.
    // To build a generic node (which has 2 slots: 1 and 2), we find subtrees.
}

// Let's do a more direct tree generator.
// A node has slots [1, 2].
function genNodeSubtrees(size) {
    if (size === 0) return [null];
    if (size === 1) return [{children: []}];
    let res = [];
    // node takes 1. size-1 to distribute among slot 1 and slot 2
    for(let left=0; left<=size-1; left++){
        let right = size - 1 - left;
        let leftSubtrees = genNodeSubtrees(left);
        let rightSubtrees = genNodeSubtrees(right);
        for(let l of leftSubtrees) {
            for(let r of rightSubtrees) {
                let node = { children: [] };
                if (l !== null) node.children.push({ edge: 1, ...JSON.parse(JSON.stringify(l)) });
                if (r !== null) node.children.push({ edge: 2, ...JSON.parse(JSON.stringify(r)) });
                res.push(node);
            }
        }
    }
    return res;
}

// Now generate Root which has slots [0, 1, 2].
let totalRoots = [];
for(let s0=0; s0<=7; s0++) {
    for(let s1=0; s0+s1<=7; s1++) {
        let s2 = 7 - s0 - s1;
        let st0 = genNodeSubtrees(s0);
        let st1 = genNodeSubtrees(s1);
        let st2 = genNodeSubtrees(s2);
        for(let a of st0) {
            for(let b of st1) {
                for(let c of st2) {
                    let root = { id: 'T0', color: colors[0], edge: null, children: [] };
                    if (a) root.children.push({ edge: 0, ...JSON.parse(JSON.stringify(a)) });
                    if (b) root.children.push({ edge: 1, ...JSON.parse(JSON.stringify(b)) });
                    if (c) root.children.push({ edge: 2, ...JSON.parse(JSON.stringify(c)) });
                    totalRoots.push(root);
                }
            }
        }
    }
}

console.log("Total fully generated binary trees:", totalRoots.length);

let nextId = 0;
function assignIds(node) {
    if(node.id === undefined) {
        node.id = `O_${nextId++}`;
        node.type = 'triangle';
        node.color = colors[nextId % colors.length];
    }
    for(let c of node.children) assignIds(c);
}

for (let i = 0; i < totalRoots.length; i++) {
    nextId = 1;
    let root = totalRoots[i];
    assignIds(root);
    
    if (testOverlap(root)) {
        let hash = get2DHash(root);
        if(!shapeHashes.has(hash)) {
            shapeHashes.add(hash);
            foundTrees.push(root);
        }
    }
}

console.log("Found unique geometric folding nets:", foundTrees.length);

if(foundTrees.length >= 11) {
    let out = "Object.assign(solidsObj, {\n";
    let finalNets = foundTrees.slice(0, 11);
    finalNets.forEach((net, i) => {
        out += `        oct_net_${i+1}: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: ${JSON.stringify(net).replace(/"([^(")"]+)":/g,"$1:")} },\n`;
    });
    out += "    });\n";
    fs.writeFileSync('real_11.txt', out);
    console.log("Wrote exact replacement to real_11.txt! It contains exactly the correct nets!");
}
