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

const polyData = { sides: 3 };
const vertices = createNGon(3);
const edges = [];
for (let i = 0; i < 3; i++) edges.push([vertices[i], vertices[(i + 1) % 3]]);
polyData.vertices = vertices;
polyData.edges = edges;

let cx = 0, cy = 0;
vertices.forEach(v => { cx += v.x; cy += v.y; });
cx /= 3; cy /= 3;

function getChildMatrix(parentMat, d, foldAngle) {
    const pEdge = polyData.edges[d];
    const vStart = pEdge[0];
    const vEnd = pEdge[1];
    let hingeMat = new THREE.Matrix4().makeTranslation(vEnd.x, vEnd.y, vEnd.z);
    const dir = vStart.clone().sub(vEnd);
    let rotZ = new THREE.Matrix4().makeRotationZ(Math.atan2(dir.y, dir.x));
    let rotX = new THREE.Matrix4().makeRotationX(foldAngle);
    hingeMat.multiply(rotZ).multiply(rotX);
    return parentMat.clone().multiply(hingeMat);
}

function getCenter(mat) {
    return new THREE.Vector3(cx, cy, 0).applyMatrix4(mat);
}

// Let's test the 4 faces meeting at a vertex.
// Root: T0
let m0 = new THREE.Matrix4();
let c0 = getCenter(m0);

let m1 = getChildMatrix(m0, 2, -Math.acos(1/3));
let c1 = getCenter(m1);

let m2 = getChildMatrix(m1, 2, -Math.acos(1/3));
let c2 = getCenter(m2);

let m3 = getChildMatrix(m2, 2, -Math.acos(1/3));
let c3 = getCenter(m3);

let m4 = getChildMatrix(m3, 2, -Math.acos(1/3));
let c4 = getCenter(m4);

console.log("C0:", c0);
console.log("C4 (should be C0):", c4);
console.log("Distance C4 to C0:", c4.distanceTo(c0));

