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

const polyData = { sides: 3 };
polyData.vertices = createNGon(3);
polyData.edges = [[polyData.vertices[0], polyData.vertices[1]], [polyData.vertices[1], polyData.vertices[2]], [polyData.vertices[2], polyData.vertices[0]]];

let t = {
    id: 'T0', label: '1', edge: null,
    children: [
        {
            id: 'T1', label: '2', edge: 1,
            children: [
                {
                    id: 'T2', label: '3', edge: 2,
                    children: [
                        {
                            id: 'T3', label: '4', edge: 1,
                            children: [
                                { id: 'T6', label: '7', edge: 1, children: [] },
                                { id: 'T7', label: '8', edge: 2, children: [] }
                            ]
                        }
                    ]
                }
            ]
        },
        { id: 'T4', label: '5', edge: 2, children: [] },
        { id: 'T5', label: '6', edge: 0, children: [] }
    ]
};

let centers = [];
const build = (nodeDef, isRoot, parentMatrix) => {
    let faceGroupMatrix = parentMatrix.clone();
    
    let cx = 0, cy = 0;
    polyData.vertices.forEach(v => { cx += v.x; cy += v.y; });
    cx /= polyData.sides; cy /= polyData.sides;
    
    let centerLocal = new THREE.Vector3(cx, cy, 0);
    centerLocal.applyMatrix4(faceGroupMatrix);
    
    centers.push({id: nodeDef.id, c: centerLocal});
    
    nodeDef.children.forEach(childDef => {
        const pEdge = polyData.edges[childDef.edge];
        const vStart = pEdge[0];
        const vEnd = pEdge[1];
        
        let hingeMat = new THREE.Matrix4().makeTranslation(vEnd.x, vEnd.y, vEnd.z);
        const dir = vStart.clone().sub(vEnd);
        let rotZ = new THREE.Matrix4().makeRotationZ(Math.atan2(dir.y, dir.x));
        let rotX = new THREE.Matrix4().makeRotationX(childDef.foldAngle !== undefined ? childDef.foldAngle : Math_acos1_3);
        hingeMat.multiply(rotZ).multiply(rotX);
        
        let childWorldMat = faceGroupMatrix.clone().multiply(hingeMat);
        build(childDef, false, childWorldMat);
    });
};
build(t, true, new THREE.Matrix4());

centers.forEach(x => {
    console.log(x.id, `[${x.c.x.toFixed(2)}, ${x.c.y.toFixed(2)}, ${x.c.z.toFixed(2)}]`);
});

// Check overlaps
for(let i=0; i<centers.length; i++){
    for(let j=i+1; j<centers.length; j++){
        if(centers[i].c.distanceTo(centers[j].c) < 1.0){
            console.log("OVERLAP:", centers[i].id, centers[j].id, "dist", centers[i].c.distanceTo(centers[j].c));
        }
    }
}
