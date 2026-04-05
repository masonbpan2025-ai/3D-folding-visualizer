import fs from 'fs';

// Geometric Simulation of my buildNet logic
const simulate = (treeStr) => {
    let tree = eval(`(${treeStr})`);
    
    // Matrix Math using simple arrays
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
    const foldAngle = -Math.acos(1/3); // 109.47 degrees interior angle. Fold is 180 - 109.47
    
    // In threejs, group translates, rotates, translates back...
    // Let's model buildNet perfectly!
    const traverse = (node, parentMat) => {
        // Center of triangle in local coords is (0,0,0). Vertices are top (0, 2h/3), botLeft (-s/2, -h/3), botRight (s/2, -h/3)
        // Add center to list
        let c = [0, 0, 0, 1];
        let wc = [0,0,0];
        for(let i=0; i<3; i++) {
            for(let j=0; j<4; j++) wc[i] += parentMat[i][j] * c[j];
        }
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
            
            // Hinge rotation
            // The edge normal is Y in the hinge local space (since edge is on X axis? No, in my code:
            // edge is along X axis. hinge rotates around X axis!
            H = mul(H, rotX(foldAngle));
            
            // Attach child
            // Child is shifted by local (0, h/3, 0) relative to hinge, then rotated by PI so it points down!
            // In main.js: const childSolid = buildNet(...)
            // childSolid.position.set(0, childH/3, 0);
            // childSolid.rotation.z = Math.PI;
            
            let cM = mul(H, trans(0, h/3, 0));
            cM = mul(cM, rotZ(Math.PI));
            
            traverse(child, mul(parentMat, cM));
        }
    };
    
    traverse(tree, I());
    
    // Check overlaps. In an octahedron, no two faces can have the same center!
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

// 2D Generator
let validNets = [];
let seenShapes = new Set();
const getCoords = (tree) => {
    let pts = [{cx:0, cy:0, rot:0}]; 
    const EPS = 1e-4;
    const addNode = (n, px, py, prot) => {
        for(let c of n.children){
            let ang = (prot + c.edge * 120 + 90) * Math.PI / 180;
            let nx = Math.round((px + Math.cos(ang))*100)/100;
            let ny = Math.round((py + Math.sin(ang))*100)/100;
            let nrot = prot + c.edge * 120 + 180; 
            pts.push({cx: nx, cy: ny, rot: nrot % 360});
            addNode(c, nx, ny, nrot);
        }
    };
    addNode(tree, 0, 0, 0);
    return pts;
};

const normalize = (tree) => {
    let pts = getCoords(tree);
    let trans = pts.map(p => ({ x: p.cx, y: p.cy }));
    let minx = Math.min(...trans.map(p=>p.x));
    let miny = Math.min(...trans.map(p=>p.y));
    let norm = trans.map(p=>`${(p.x-minx).toFixed(2)}_${(p.y-miny).toFixed(2)}`).sort().join('|');
    return norm;
};

let idCtr = 1;
const search = (nodeStrTpl, numNodes, availSlots, coordsMap) => {
    if(numNodes === 8){
        let tree = eval(`(${nodeStrTpl})`);
        let hash = normalize(tree);
        // Only check 2D overlaps (coordsMap size == 8)
        if(coordsMap.size === 8 && !seenShapes.has(hash)){
            seenShapes.add(hash);
            if(simulate(nodeStrTpl)) {
                validNets.push(tree);
            }
        }
        return;
    }

    for(let i=0; i<availSlots.length; i++){
        let slot = availSlots[i];
        let d = slot.edge;
        
        let nSlots = [...availSlots];
        nSlots.splice(i, 1);
        
        // 2D forward
        let ang = (slot.prot + d * 120 + 90) * Math.PI / 180;
        let nx = Math.round((slot.px + Math.cos(ang))*100)/100;
        let ny = Math.round((slot.py + Math.sin(ang))*100)/100;
        let ck = `${nx}_${ny}`;
        let nprot = slot.prot + d * 120 + 180;

        let nmap = new Set(coordsMap);
        nmap.add(ck);
        
        // Add node
        let childId = numNodes;
        let cStr = `{ id: 'O_${idCtr}_${childId}', type: 'triangle', edge: ${d}, children: [] }`;
        let nTpl = nodeStrTpl.replace(`/*SLOT_${slot.id}*/`, cStr + `, /*SLOT_${childId}_new*/ /*SLOT_${slot.id}*/`);
        let nTpl2 = nTpl.replace(`/*SLOT_${childId}_new*/`, `/*SLOT_C${childId}_1*/ /*SLOT_C${childId}_2*/`);
        
        nSlots.push({ id: `C${childId}_1`, edge: 1, px: nx, py: ny, prot: nprot });
        nSlots.push({ id: `C${childId}_2`, edge: 2, px: nx, py: ny, prot: nprot });
        
        search(nTpl2, numNodes+1, nSlots, nmap);
    }
};

let slots = [
    { id: 'R_0', edge: 0, px:0, py:0, prot:0 },
    { id: 'R_1', edge: 1, px:0, py:0, prot:0 },
    { id: 'R_2', edge: 2, px:0, py:0, prot:0 }
];
let rootTpl = `{ id: 'O_${idCtr}_0', type: 'triangle', children: [ /*SLOT_R_0*/ /*SLOT_R_1*/ /*SLOT_R_2*/ ] }`;
let cmap = new Set(["0_0"]);
search(rootTpl, 1, slots, cmap);

console.log("Total unique valid 3D non-overlapping nets:", validNets.length);

// Assign colors and exact format
let output = "const generated_nets = {\n";
validNets.forEach((net, i) => {
    let colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#eab308', '#0d9488', '#059669', '#3b82f6'];
    let cidx = 0;
    const cleanTree = (n) => {
        let res = { id: n.id, type: n.type, color: colors[cidx++], children: [] };
        if(n.edge !== undefined) res.edge = n.edge;
        for(let c of n.children) if(c.id) res.children.push(cleanTree(c));
        return res;
    };
    output += `    oct_net_${i+1}: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: ${JSON.stringify(cleanTree(net)).replace(/"([^(")"]+)":/g,"$1:")} },\n`;
});
output += "};\n";

fs.writeFileSync('generated_nets.js', output);
