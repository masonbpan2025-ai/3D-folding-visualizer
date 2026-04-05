import * as THREE from 'three';

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
    let n = type === 'square' ? 4 : type === 'pentagon' ? 5 : 3;
    const vertices = createNGon(n);
    const edges = [];
    for (let i = 0; i < n; i++) edges.push([vertices[i], vertices[(i + 1) % n]]);
    polygonCache[type] = { vertices, edges, sides: n };
    return polygonCache[type];
}

const testOverlap = (treeDef) => {
    let centers = [];
    
    // Simulate buildNet recursively but compute centers in world space
    const build = (nodeDef, isRoot, parentMatrix) => {
        const polyData = getPolygonData(nodeDef.type || 'triangle');
        
        // Face Group local matrix = identity relative to hinge
        let faceGroupMatrix = parentMatrix.clone();
        
        // Calculate center of polygon
        let cx = 0, cy = 0;
        polyData.vertices.forEach(v => { cx += v.x; cy += v.y; });
        cx /= polyData.sides; cy /= polyData.sides;
        
        let centerLocal = new THREE.Vector3(cx, cy, 0);
        centerLocal.applyMatrix4(faceGroupMatrix);
        centers.push(centerLocal);
        
        nodeDef.children.forEach(childDef => {
            const pEdge = polyData.edges[childDef.edge];
            const vStart = pEdge[0];
            const vEnd = pEdge[1];
            
            // Hinge translation to vEnd
            let hingeMat = new THREE.Matrix4().makeTranslation(vEnd.x, vEnd.y, vEnd.z);
            
            // Hinge rotation Z
            const dir = vStart.clone().sub(vEnd);
            let rotZ = new THREE.Matrix4().makeRotationZ(Math.atan2(dir.y, dir.x));
            
            // Hinge rotation X
            let rotX = new THREE.Matrix4().makeRotationX(childDef.foldAngle !== undefined ? childDef.foldAngle : -Math.acos(1/3));
            
            hingeMat.multiply(rotZ).multiply(rotX);
            
            let childWorldMat = faceGroupMatrix.clone().multiply(hingeMat);
            build(childDef, false, childWorldMat);
        });
    };
    
    build(treeDef, true, new THREE.Matrix4());
    
    // Check overlaps
    let overlap = false;
    for(let i=0; i<centers.length; i++){
        for(let j=i+1; j<centers.length; j++){
            if(centers[i].distanceTo(centers[j]) < 1.0){
                overlap = true;
            }
        }
    }
    return !overlap;
};

import fs from 'fs';
let solidsObj = {};
// Evaluate the injected oct_net strings from my previous run...
const injectionStr = fs.readFileSync('main.js', 'utf8');
const match = injectionStr.match(/oct_net_1:[\s\S]*?oct_net_11:[\s\S]*?}\s*}/);
if(match) {
    eval('solidsObj = {' + match[0] + '}');
}

let ok = 0;
for(let i=1; i<=11; i++){
    if(solidsObj[`oct_net_${i}`]) {
        let valid = testOverlap(solidsObj[`oct_net_${i}`].net);
        console.log(`oct_net_${i}: ${valid}`);
        if(valid) ok++;
    }
}
console.log(`Total valid: ${ok}/11`);

