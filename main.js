import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ---- SCENE SETUP ----
const canvasContainer = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d0f12');
scene.fog = new THREE.FogExp2('#0d0f12', 0.015);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, -30, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// ---- LIGHTING ----
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, -20, 50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x88bbff, 0.4);
fillLight.position.set(-20, 20, 20);
scene.add(fillLight);

const gridHelper = new THREE.GridHelper(100, 20, 0x444444, 0x222222);
gridHelper.rotation.x = Math.PI / 2;
scene.add(gridHelper);

// ---- POLYGON GENERATOR ----
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
    
    let n = 3;
    if (type === 'square') n = 4;
    else if (type === 'pentagon') n = 5;

    const vertices = createNGon(n);
    
    // Create Shape
    const shape = new THREE.Shape();
    shape.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < n; i++) {
        shape.lineTo(vertices[i].x, vertices[i].y);
    }
    shape.lineTo(vertices[0].x, vertices[0].y);

    const geometry = new THREE.ShapeGeometry(shape);
    
    // Bounds for UV
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    vertices.forEach(v => {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
    });
    
    const posAttr = geometry.attributes.position;
    const uvAttr = geometry.attributes.uv;
    for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        uvAttr.setXY(i, (x - minX) / (maxX - minX), (y - minY) / (maxY - minY));
    }
    
    // Generate edge pairs for hinge logic
    const edges = [];
    for (let i = 0; i < n; i++) {
        edges.push([vertices[i], vertices[(i + 1) % n]]);
    }
    
    polygonCache[type] = { vertices, edges, geometry, sides: n };
    return polygonCache[type];
}

function createFaceMaterial(label, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 200px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 256);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    return new THREE.MeshStandardMaterial({
        map: tex,
        metalness: 0.1,
        roughness: 0.4,
        side: THREE.DoubleSide
    });
}

// ---- CUBE PRODUCERS ----
const makeCube141 = (t, b) => {
    const createStripNode = (idx) => {
        const node = { id: `S${idx}`, label: `${idx+1}`, color: '#2563eb', children: [] };
        if (idx < 3) {
            const nextNode = createStripNode(idx + 1);
            nextNode.edge = (idx === 0) ? 1 : 2; 
            node.children.push(nextNode);
        }
        if (idx === t) { node.children.push({ id: `T${idx}`, label: '5', color: '#db2777', edge: (idx === 0) ? 2 : 3, children: [] }); }
        if (idx === b) { node.children.push({ id: `B${idx}`, label: '6', color: '#0d9488', edge: (idx === 0) ? 0 : 1, children: [] }); }
        return node;
    };
    return createStripNode(0);
};

const makeCube231 = (t, b) => {
    const createStripNode = (idx) => {
        const node = { id: `S${idx}`, label: `${idx+1}`, color: '#2563eb', children: [] };
        if (idx < 2) {
            const nextNode = createStripNode(idx + 1);
            nextNode.edge = (idx === 0) ? 1 : 2; 
            node.children.push(nextNode);
        }
        if (idx === t) {
            const t0 = { id: `T${idx}`, label: '4', color: '#db2777', edge: (idx === 0) ? 2 : 3, children: [] };
            t0.children.push({ id: `T${idx}_1`, label: '5', color: '#ea580c', edge: 1, children: [] });
            node.children.push(t0);
        }
        if (idx === b) { node.children.push({ id: `B${idx}`, label: '6', color: '#0d9488', edge: (idx === 0) ? 0 : 1, children: [] }); }
        return node;
    };
    return createStripNode(0);
};

const makeCube33 = () => ({
    id: 'S0', label: '1', color: '#2563eb', children: [
        { id: 'S1', label: '2', color: '#7c3aed', edge: 1, children: [
            { id: 'S2', label: '3', color: '#db2777', edge: 2, children: [
                { id: 'T0', label: '4', color: '#ea580c', edge: 3, children: [
                    { id: 'T1', label: '5', color: '#059669', edge: 1, children: [
                        { id: 'T2', label: '6', color: '#eab308', edge: 2, children: [] }
                    ]}
                ]}
            ]}
        ]}
    ]
});

const makeCube222 = () => ({
    id: 'S0', label: '1', color: '#2563eb', children: [
        { id: 'S1', label: '2', color: '#7c3aed', edge: 1, children: [
            { id: 'M0', label: '3', color: '#db2777', edge: 3, children: [
                { id: 'M1', label: '4', color: '#ea580c', edge: 1, children: [
                    { id: 'T0', label: '5', color: '#059669', edge: 3, children: [
                        { id: 'T1', label: '6', color: '#eab308', edge: 1, children: [] }
                    ]}
                ]}
            ]}
        ]}
    ]
});

const makeTriPrism = (t, b) => {
    const createStripNode = (idx) => {
        const node = { id: `S${idx}`, label: `${idx+1}`, color: '#2563eb', children: [] };
        if (idx < 2) {
            const nextNode = createStripNode(idx + 1);
            nextNode.edge = (idx === 0) ? 1 : 2; 
            node.children.push(nextNode);
        }
        if (idx === t) { node.children.push({ id: `T${idx}`, type: 'triangle', label: 'T', color: '#059669', edge: (idx === 0) ? 2 : 3, foldAngle: -Math.PI / 2, children: [] }); }
        if (idx === b) { node.children.push({ id: `B${idx}`, type: 'triangle', label: 'B', color: '#eab308', edge: (idx === 0) ? 0 : 1, foldAngle: -Math.PI / 2, children: [] }); }
        return node;
    };
    return createStripNode(0);
};

const puzzleA = () => ({
    id: 'A_Sq0', color: '#fde047', children: [
        { id: 'A_Tri1', type: 'triangle', edge: 2, foldAngle: -Math.PI/2, color: '#fde047', children: [
            { id: 'A_Sq2', type: 'square', edge: 1, foldAngle: -Math.PI/2, color: '#fde047', children: [
                { id: 'A_Tri2', type: 'triangle', edge: 2, foldAngle: -Math.PI/2, color: '#fde047', children: [
                    { id: 'A_Sq3', type: 'square', edge: 2, foldAngle: -Math.PI/2, color: '#fde047', children: [] }
                ]}
            ]}
        ]}
    ]
});

const puzzleB = () => ({
    id: 'B_SqC', color: '#22c55e', children: [
        { id: 'B_SqD', type: 'square', edge: 0, foldAngle: -Math.PI*2/3, color: '#22c55e', children: [] },
        { id: 'B_TriL', type: 'triangle', edge: 3, foldAngle: -Math.PI/2, color: '#22c55e', children: [] },
        { id: 'B_TriR', type: 'triangle', edge: 1, foldAngle: -Math.PI/2, color: '#22c55e', children: [
            { id: 'B_SqT', type: 'square', edge: 2, foldAngle: -Math.PI/2, color: '#22c55e', children: [] }
        ]}
    ]
});

const puzzleC = () => ({
    id: 'C_SqTop', color: '#06b6d4', children: [
        { id: 'C_TriR', type: 'triangle', edge: 1, foldAngle: -Math.PI/2, color: '#06b6d4', children: [
            { id: 'C_SqR', type: 'square', edge: 2, foldAngle: -Math.PI/2, color: '#06b6d4', children: [] }
        ]},
        { id: 'C_TriL', type: 'triangle', edge: 3, foldAngle: -Math.PI/2, color: '#06b6d4', children: [
            { id: 'C_SqL', type: 'square', edge: 2, foldAngle: -Math.PI/2, color: '#06b6d4', children: [] }
        ]}
    ]
});

const puzzleD = () => ({
    id: 'D_SqMid', color: '#ef4444', children: [
        { id: 'D_SqBot', type: 'square', edge: 0, foldAngle: -Math.PI*2/3, color: '#ef4444', children: [] },
        { id: 'D_TriR', type: 'triangle', edge: 1, foldAngle: -Math.PI/2, color: '#ef4444', children: [] },
        { id: 'D_SqTop', type: 'square', edge: 2, foldAngle: -Math.PI*2/3, color: '#ef4444', children: [
            { id: 'D_TriL', type: 'triangle', edge: 3, foldAngle: -Math.PI/2, color: '#ef4444', children: [] }
        ]}
    ]
});

const puzzleE = () => ({
    id: 'E_SqMid', color: '#bef264', children: [
        { id: 'E_SqBot', type: 'square', edge: 0, foldAngle: -Math.PI*2/3, color: '#bef264', children: [
            { id: 'E_TriBot', type: 'triangle', edge: 0, foldAngle: -Math.PI/2, color: '#bef264', children: [] }
        ]},
        { id: 'E_TriMid', type: 'triangle', edge: 3, foldAngle: -Math.PI/2, color: '#bef264', children: [
            { id: 'E_SqTilted', type: 'square', edge: 1, foldAngle: -Math.PI/2, color: '#bef264', children: [] }
        ]}
    ]
});

const puzzleF = () => ({
    id: 'F_SqMid', color: '#f97316', children: [
        { id: 'F_SqL', type: 'square', edge: 3, foldAngle: -Math.PI*2/3, color: '#f97316', children: [] },
        { id: 'F_SqR', type: 'square', edge: 1, foldAngle: -Math.PI*2/3, color: '#f97316', children: [
            { id: 'F_TriR', type: 'triangle', edge: 1, foldAngle: -Math.PI/2, color: '#f97316', children: [] }
        ]},
        { id: 'F_TriT', type: 'triangle', edge: 2, foldAngle: -Math.PI/2, color: '#f97316', children: [] }
    ]
});

const puzzleG = () => ({
    id: 'G_SqL', color: '#1d4ed8', children: [
        { id: 'G_SqR', type: 'square', edge: 1, foldAngle: -Math.PI*2/3, color: '#1d4ed8', children: [
            { id: 'G_TriD', type: 'triangle', edge: 0, foldAngle: -Math.PI/2, color: '#1d4ed8', children: [] }
        ]},
        { id: 'G_TriL', type: 'triangle', edge: 3, foldAngle: -Math.PI/2, color: '#1d4ed8', children: [
            { id: 'G_SqTilted', type: 'square', edge: 1, foldAngle: -Math.PI/2, color: '#1d4ed8', children: [] }
        ]}
    ]
});

const puzzleH = () => ({
    id: 'H_SqBot', color: '#9a3412', children: [
        { id: 'H_SqMid', type: 'square', edge: 2, foldAngle: -Math.PI*2/3, color: '#9a3412', children: [
            { id: 'H_TriMid', type: 'triangle', edge: 3, foldAngle: -Math.PI/2, color: '#9a3412', children: [
                { id: 'H_SqTilted', type: 'square', edge: 1, foldAngle: -Math.PI/2, color: '#9a3412', children: [
                    { id: 'H_TriTop', type: 'triangle', edge: 2, foldAngle: -Math.PI/2, color: '#9a3412', children: [] }
                ]}
            ]}
        ]}
    ]
});

// ---- SOLID DEFINITIONS ----
const solids = {
    puzzle_a: { defaultType: 'square', foldAngle: 0, net: puzzleA() },
    puzzle_b: { defaultType: 'square', foldAngle: 0, net: puzzleB() },
    puzzle_c: { defaultType: 'square', foldAngle: 0, net: puzzleC() },
    puzzle_d: { defaultType: 'square', foldAngle: 0, net: puzzleD() },
    puzzle_e: { defaultType: 'square', foldAngle: 0, net: puzzleE() },
    puzzle_f: { defaultType: 'square', foldAngle: 0, net: puzzleF() },
    puzzle_g: { defaultType: 'square', foldAngle: 0, net: puzzleG() },
    puzzle_h: { defaultType: 'square', foldAngle: 0, net: puzzleH() },
    cube_1: { foldAngle: -Math.PI / 2, defaultType: 'square', net: makeCube141(1, 1) }, // Cross
    cube_2: { foldAngle: -Math.PI / 2, defaultType: 'square', net: makeCube141(0, 0) },
    cube_3: { foldAngle: -Math.PI / 2, defaultType: 'square', net: makeCube141(0, 1) },
    cube_4: { foldAngle: -Math.PI / 2, defaultType: 'square', net: makeCube141(0, 2) },
    cube_5: { foldAngle: -Math.PI / 2, defaultType: 'square', net: makeCube141(0, 3) },
    cube_6: { foldAngle: -Math.PI / 2, defaultType: 'square', net: makeCube141(1, 2) },
    cube_7: { foldAngle: -Math.PI / 2, defaultType: 'square', net: makeCube231(0, 0) },
    cube_8: { foldAngle: -Math.PI / 2, defaultType: 'square', net: makeCube231(0, 1) },
    cube_9: { foldAngle: -Math.PI / 2, defaultType: 'square', net: makeCube231(1, 1) },
    cube_10: { foldAngle: -Math.PI / 2, defaultType: 'square', net: makeCube33() },
    cube_11: { foldAngle: -Math.PI / 2, defaultType: 'square', net: makeCube222() },
    octahedron: {
        foldAngle: -Math.acos(1 / 3),
        defaultType: 'triangle',
        net: {
            id: 'T0', label: '1', color: '#2563eb', edge: null,
            children: [
                {
                    id: 'T1', label: '2', color: '#7c3aed', edge: 1,
                    children: [
                        {
                            id: 'T2', label: '3', color: '#db2777', edge: 2,
                            children: [
                                {
                                    id: 'T3', label: '4', color: '#ea580c', edge: 1,
                                    children: [
                                        { id: 'T6', label: '7', color: '#eab308', edge: 1, children: [] },
                                        { id: 'T7', label: '8', color: '#f87171', edge: 2, children: [] }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                { id: 'T4', label: '5', color: '#059669', edge: 2, children: [] },
                { id: 'T5', label: '6', color: '#0d9488', edge: 0, children: [] }
            ]
        }
    },
    tetrahedron: {
        foldAngle: -(Math.PI - Math.acos(1 / 3)),
        defaultType: 'triangle',
        net: {
            id: 'T0', label: '1', color: '#2563eb',
            children: [
                { id: 'T1', label: '2', color: '#7c3aed', edge: 0, children: [] },
                { id: 'T2', label: '3', color: '#db2777', edge: 1, children: [] },
                { id: 'T3', label: '4', color: '#059669', edge: 2, children: [] }
            ]
        }
    },
    square_pyramid: {
        foldAngle: -(Math.PI - Math.acos(1 / Math.sqrt(3))),
        defaultType: 'square',
        net: {
            id: 'S0', label: 'Base', color: '#1e293b',
            children: [
                { id: 'T1', type: 'triangle', label: 'S1', color: '#2563eb', edge: 0, children: [] },
                { id: 'T2', type: 'triangle', label: 'S2', color: '#7c3aed', edge: 1, children: [] },
                { id: 'T3', type: 'triangle', label: 'S3', color: '#db2777', edge: 2, children: [] },
                { id: 'T4', type: 'triangle', label: 'S4', color: '#059669', edge: 3, children: [] }
            ]
        }
    },
    dodecahedron: {
        foldAngle: -(Math.PI - Math.acos(-1 / Math.sqrt(5))),
        defaultType: 'pentagon',
        net: {
            id: 'C1', label: '1', color: '#2563eb',
            children: [
                { id: 'P1', label: '2', color: '#7c3aed', edge: 0, children: [] },
                { id: 'P2', label: '3', color: '#db2777', edge: 1, children: [] },
                { id: 'P3', label: '4', color: '#ea580c', edge: 2, children: [] },
                { id: 'P4', label: '5', color: '#eab308', edge: 3, children: [] },
                { id: 'P5', label: '6', color: '#059669', edge: 4, children: [
                    { id: 'C2', label: '12', color: '#2563eb', edge: 2, children: [
                        { id: 'P6', label: '7', color: '#7c3aed', edge: 3, children: [] },
                        { id: 'P7', label: '8', color: '#db2777', edge: 2, children: [] },
                        { id: 'P8', label: '9', color: '#ea580c', edge: 1, children: [] },
                        { id: 'P9', label: '10', color: '#eab308', edge: 0, children: [] },
                        { id: 'P10', label: '11', color: '#059669', edge: 4, children: [] }
                    ]}
                ]}
            ]
        }
    }
};

const addOctahedronNets = (solidsObj) => {
    Object.assign(solidsObj, {
        oct_net_1: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: {id:"T0",color:"#2563eb",edge:null,children:[{edge:2,children:[{edge:2,children:[{edge:2,children:[{edge:1,children:[{edge:2,children:[{edge:1,children:[{edge:1,children:[],id:"O_7",label:"8",type:"triangle",color:"#2563eb"}],id:"O_6",label:"7",type:"triangle",color:"#3b82f6"}],id:"O_5",label:"6",type:"triangle",color:"#059669"}],id:"O_4",label:"5",type:"triangle",color:"#0d9488"}],id:"O_3",label:"4",type:"triangle",color:"#eab308"}],id:"O_2",label:"3",type:"triangle",color:"#ea580c"}],id:"O_1",label:"2",type:"triangle",color:"#db2777"}]} },
        oct_net_2: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: {id:"T0",color:"#2563eb",edge:null,children:[{edge:2,children:[{edge:2,children:[{edge:2,children:[{edge:1,children:[{edge:1,children:[],id:"O_5",label:"6",type:"triangle",color:"#059669"},{edge:2,children:[{edge:1,children:[],id:"O_7",label:"8",type:"triangle",color:"#2563eb"}],id:"O_6",label:"7",type:"triangle",color:"#3b82f6"}],id:"O_4",label:"5",type:"triangle",color:"#0d9488"}],id:"O_3",label:"4",type:"triangle",color:"#eab308"}],id:"O_2",label:"3",type:"triangle",color:"#ea580c"}],id:"O_1",label:"2",type:"triangle",color:"#db2777"}]} },
        oct_net_3: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: {id:"T0",color:"#2563eb",edge:null,children:[{edge:2,children:[{edge:2,children:[{edge:2,children:[{edge:1,children:[{edge:1,children:[{edge:2,children:[],id:"O_6",label:"7",type:"triangle",color:"#3b82f6"}],id:"O_5",label:"6",type:"triangle",color:"#059669"},{edge:2,children:[],id:"O_7",label:"8",type:"triangle",color:"#2563eb"}],id:"O_4",label:"5",type:"triangle",color:"#0d9488"}],id:"O_3",label:"4",type:"triangle",color:"#eab308"}],id:"O_2",label:"3",type:"triangle",color:"#ea580c"}],id:"O_1",label:"2",type:"triangle",color:"#db2777"}]} },
        oct_net_4: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: {id:"T0",color:"#2563eb",edge:null,children:[{edge:2,children:[{edge:2,children:[{edge:2,children:[{edge:1,children:[{edge:1,children:[{edge:2,children:[{edge:2,children:[],id:"O_7",label:"8",type:"triangle",color:"#2563eb"}],id:"O_6",label:"7",type:"triangle",color:"#3b82f6"}],id:"O_5",label:"6",type:"triangle",color:"#059669"}],id:"O_4",label:"5",type:"triangle",color:"#0d9488"}],id:"O_3",label:"4",type:"triangle",color:"#eab308"}],id:"O_2",label:"3",type:"triangle",color:"#ea580c"}],id:"O_1",label:"2",type:"triangle",color:"#db2777"}]} },
        oct_net_5: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: {id:"T0",color:"#2563eb",edge:null,children:[{edge:2,children:[{edge:2,children:[{edge:1,children:[],id:"O_3",label:"4",type:"triangle",color:"#eab308"},{edge:2,children:[{edge:1,children:[{edge:2,children:[{edge:1,children:[],id:"O_7",label:"8",type:"triangle",color:"#2563eb"}],id:"O_6",label:"7",type:"triangle",color:"#3b82f6"}],id:"O_5",label:"6",type:"triangle",color:"#059669"}],id:"O_4",label:"5",type:"triangle",color:"#0d9488"}],id:"O_2",label:"3",type:"triangle",color:"#ea580c"}],id:"O_1",label:"2",type:"triangle",color:"#db2777"}]} },
        oct_net_6: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: {id:"T0",color:"#2563eb",edge:null,children:[{edge:2,children:[{edge:2,children:[{edge:1,children:[{edge:1,children:[],id:"O_4",label:"5",type:"triangle",color:"#0d9488"}],id:"O_3",label:"4",type:"triangle",color:"#eab308"},{edge:2,children:[{edge:1,children:[{edge:2,children:[],id:"O_7",label:"8",type:"triangle",color:"#2563eb"}],id:"O_6",label:"7",type:"triangle",color:"#3b82f6"}],id:"O_5",label:"6",type:"triangle",color:"#059669"}],id:"O_2",label:"3",type:"triangle",color:"#ea580c"}],id:"O_1",label:"2",type:"triangle",color:"#db2777"}]} },
        oct_net_7: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: {id:"T0",color:"#2563eb",edge:null,children:[{edge:2,children:[{edge:2,children:[{edge:1,children:[{edge:1,children:[],id:"O_4",label:"5",type:"triangle",color:"#0d9488"},{edge:2,children:[{edge:1,children:[],id:"O_6",label:"7",type:"triangle",color:"#3b82f6"}],id:"O_5",label:"6",type:"triangle",color:"#059669"}],id:"O_3",label:"4",type:"triangle",color:"#eab308"},{edge:2,children:[],id:"O_7",label:"8",type:"triangle",color:"#2563eb"}],id:"O_2",label:"3",type:"triangle",color:"#ea580c"}],id:"O_1",label:"2",type:"triangle",color:"#db2777"}]} },
        oct_net_8: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: {id:"T0",color:"#2563eb",edge:null,children:[{edge:2,children:[{edge:2,children:[{edge:1,children:[{edge:1,children:[{edge:2,children:[],id:"O_5",label:"6",type:"triangle",color:"#059669"}],id:"O_4",label:"5",type:"triangle",color:"#0d9488"},{edge:2,children:[],id:"O_6",label:"7",type:"triangle",color:"#3b82f6"}],id:"O_3",label:"4",type:"triangle",color:"#eab308"},{edge:2,children:[],id:"O_7",label:"8",type:"triangle",color:"#2563eb"}],id:"O_2",label:"3",type:"triangle",color:"#ea580c"}],id:"O_1",label:"2",type:"triangle",color:"#db2777"}]} },
        oct_net_9: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: {id:"T0",color:"#2563eb",edge:null,children:[{edge:2,children:[{edge:2,children:[{edge:1,children:[{edge:1,children:[],id:"O_4",label:"5",type:"triangle",color:"#0d9488"},{edge:2,children:[{edge:1,children:[],id:"O_6",label:"7",type:"triangle",color:"#3b82f6"},{edge:2,children:[],id:"O_7",label:"8",type:"triangle",color:"#2563eb"}],id:"O_5",label:"6",type:"triangle",color:"#059669"}],id:"O_3",label:"4",type:"triangle",color:"#eab308"}],id:"O_2",label:"3",type:"triangle",color:"#ea580c"}],id:"O_1",label:"2",type:"triangle",color:"#db2777"}]} },
        oct_net_10: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: {id:"T0",color:"#2563eb",edge:null,children:[{edge:2,children:[{edge:2,children:[{edge:1,children:[{edge:1,children:[{edge:2,children:[{edge:2,children:[{edge:1,children:[],id:"O_7",label:"8",type:"triangle",color:"#2563eb"}],id:"O_6",label:"7",type:"triangle",color:"#3b82f6"}],id:"O_5",label:"6",type:"triangle",color:"#059669"}],id:"O_4",label:"5",type:"triangle",color:"#0d9488"}],id:"O_3",label:"4",type:"triangle",color:"#eab308"}],id:"O_2",label:"3",type:"triangle",color:"#ea580c"}],id:"O_1",label:"2",type:"triangle",color:"#db2777"}]} },
        oct_net_11: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: {id:"T0",color:"#2563eb",edge:null,children:[{edge:2,children:[{edge:1,children:[],id:"O_2",label:"3",type:"triangle",color:"#ea580c"},{edge:2,children:[{edge:2,children:[{edge:1,children:[{edge:1,children:[],id:"O_6",label:"7",type:"triangle",color:"#3b82f6"},{edge:2,children:[],id:"O_7",label:"8",type:"triangle",color:"#2563eb"}],id:"O_5",label:"6",type:"triangle",color:"#059669"}],id:"O_4",label:"5",type:"triangle",color:"#0d9488"}],id:"O_3",label:"4",type:"triangle",color:"#eab308"}],id:"O_1",label:"2",type:"triangle",color:"#db2777"}]} },
    });
};

addOctahedronNets(solids);

Object.assign(solids, {
    tri_prism_1: { foldAngle: -Math.PI * 120 / 180, defaultType: 'square', net: makeTriPrism(0, 0) },
    tri_prism_2: { foldAngle: -Math.PI * 120 / 180, defaultType: 'square', net: makeTriPrism(0, 1) },
    tri_prism_3: { foldAngle: -Math.PI * 120 / 180, defaultType: 'square', net: makeTriPrism(0, 2) },
    tri_prism_4: { foldAngle: -Math.PI * 120 / 180, defaultType: 'square', net: makeTriPrism(1, 0) },
    tri_prism_5: { foldAngle: -Math.PI * 120 / 180, defaultType: 'square', net: makeTriPrism(1, 1) },
    tri_prism_6: { foldAngle: -Math.PI * 120 / 180, defaultType: 'square', net: makeTriPrism(1, 2) },
    tri_prism_7: { foldAngle: -Math.PI * 120 / 180, defaultType: 'square', net: makeTriPrism(2, 0) },
    tri_prism_8: { foldAngle: -Math.PI * 120 / 180, defaultType: 'square', net: makeTriPrism(2, 1) },
    tri_prism_9: { foldAngle: -Math.PI * 120 / 180, defaultType: 'square', net: makeTriPrism(2, 2) },
    dodecahedron: {
        foldAngle: -(Math.PI - Math.acos(-1 / Math.sqrt(5))),
        defaultType: 'pentagon',
        net: {
            id: 'C1', label: '1', color: '#2563eb',
            children: [
                { id: 'A2', label: '2', color: '#db2777', edge: 1, children: [] },
                { id: 'A3', label: '3', color: '#ea580c', edge: 2, children: [] },
                { id: 'A4', label: '4', color: '#059669', edge: 3, children: [] },
                { id: 'A5', label: '5', color: '#0d9488', edge: 4, children: [] },
                { id: 'A1', label: '6', color: '#7c3aed', edge: 0, children: [
                    { id: 'B1', label: '7', color: '#eab308', edge: 2, children: [
                        { id: 'C2', label: '8', color: '#f87171', edge: 3, children: [
                            { id: 'B2', label: '9', color: '#ec4899', edge: 1, children: [] },
                            { id: 'B3', label: '10', color: '#8b5cf6', edge: 2, children: [] },
                            { id: 'B4', label: '11', color: '#06b6d4', edge: 3, children: [] },
                            { id: 'B5', label: '12', color: '#f97316', edge: 4, children: [] }
                        ]}
                    ]}
                ]}
            ]
        }
    }
});

let currentSolid = solids.octahedron;
let rootNode = null;
let allHinges = [];

function buildNet(nodeDef, isRoot = false) {
    const faceType = nodeDef.type || currentSolid.defaultType;
    const polyData = getPolygonData(faceType);
    
    const faceGroup = new THREE.Group();
    
    const matIndex = createFaceMaterial(nodeDef.label, nodeDef.color);
    const meshFront = new THREE.Mesh(polyData.geometry, matIndex);
    meshFront.castShadow = true;
    meshFront.receiveShadow = true;
    faceGroup.add(meshFront);

    // Identify hinge edges to find boundaries
    const hingeEdges = new Set();
    if (!isRoot) hingeEdges.add(0); // Child always attaches via its local Edge 0
    nodeDef.children.forEach(childDef => hingeEdges.add(childDef.edge));

    // Add highlighted cylinders on boundary edges
    for (let i = 0; i < polyData.sides; i++) {
        if (!hingeEdges.has(i)) {
            const p1 = polyData.edges[i][0];
            const p2 = polyData.edges[i][1];
            const distance = p1.distanceTo(p2);
            
            const cylGeo = new THREE.CylinderGeometry(0.25, 0.25, distance, 12);
            // We use a temporary material; auto-color will update later
            const cylMat = new THREE.MeshStandardMaterial({ 
                color: '#ffffff', roughness: 0.2, metalness: 0.1 
            });
            const cylinder = new THREE.Mesh(cylGeo, cylMat);
            
            const mid = p1.clone().lerp(p2, 0.5);
            cylinder.position.copy(mid);
            
            const direction = p2.clone().sub(p1).normalize();
            cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            
            cylinder.userData.isEdgeMarker = true;
            faceGroup.add(cylinder);
        }
    }

    // Build children
    nodeDef.children.forEach(childDef => {
        const hinge = new THREE.Group();
        hinge.userData.isHinge = true;
        hinge.userData.targetFoldAngle = childDef.foldAngle !== undefined ? childDef.foldAngle : currentSolid.foldAngle;
        hinge.rotation.order = 'ZYX';
        
        // Universal Hinge Math: 
        // Align local X axis backward along the parent's target edge
        const pEdge = polyData.edges[childDef.edge];
        const vStart = pEdge[0];
        const vEnd = pEdge[1];
        
        hinge.position.copy(vEnd);
        const dir = vStart.clone().sub(vEnd);
        hinge.rotation.z = Math.atan2(dir.y, dir.x);

        const childGroup = buildNet(childDef, false);
        hinge.add(childGroup);
        faceGroup.add(hinge);
        allHinges.push(hinge);
    });

    return faceGroup;
}

function computeAutoHighlights() {
    const palette = ['#ff0055', '#00ddff', '#ffdd00', '#00ff55', '#dd00ff', '#ff5500', '#0055ff', '#55ff00', '#5500ff', '#00ffcc', '#ffcc00', '#ff00aa', '#aaff00'];
    let colorIndex = 0;

    // Temporarily fold solid to compute matches
    allHinges.forEach(h => h.rotation.x = h.userData.targetFoldAngle);
    rootNode.updateMatrixWorld(true);

    const edges = [];
    rootNode.traverse(child => {
        if (child.userData.isEdgeMarker) edges.push(child);
    });

    const paired = new Set();
    for (let i = 0; i < edges.length; i++) {
        if (paired.has(i)) continue;
        const pos1 = new THREE.Vector3().setFromMatrixPosition(edges[i].matrixWorld);
        
        let closestJ = -1;
        let minDist = 0.5;
        for (let j = i + 1; j < edges.length; j++) {
            if (paired.has(j)) continue;
            const pos2 = new THREE.Vector3().setFromMatrixPosition(edges[j].matrixWorld);
            const d = pos1.distanceTo(pos2);
            if (d < minDist) {
                minDist = d;
                closestJ = j;
            }
        }

        if (closestJ !== -1) {
            const color = palette[colorIndex % palette.length];
            colorIndex++;
            edges[i].material.color.set(color);
            edges[closestJ].material.color.set(color);
            edges[i].userData.hasPair = true;
            edges[closestJ].userData.hasPair = true;
            paired.add(i);
            paired.add(closestJ);
        } else {
            edges[i].userData.hasPair = false;
            edges[i].visible = false;
        }
    }

    // Unfold back to initial flat state
    allHinges.forEach(h => h.rotation.x = 0);
}

function loadShape(shapeKey) {
    if (rootNode) {
        scene.remove(rootNode);
    }
    currentSolid = solids[shapeKey];
    allHinges = [];
    
    rootNode = buildNet(currentSolid.net, true);
    
    // Auto-center shape in World. We use the bounds of the base.
    const basePoly = getPolygonData(currentSolid.defaultType);
    let cx = 0, cy = 0;
    basePoly.vertices.forEach(v => { cx += v.x; cy += v.y; });
    cx /= basePoly.sides;
    cy /= basePoly.sides;
    
    rootNode.position.set(-cx, -cy, 0);
    scene.add(rootNode);
    
    computeAutoHighlights();
}

// ---- INTERACTION AND DOM ALIGNMENT ----
const foldSlider = document.getElementById('foldSlider');
const btnFold = document.getElementById('btnFold');
const btnUnfold = document.getElementById('btnUnfold');
const shapeSelect = document.getElementById('shapeSelect');
const btnToggleEdges = document.getElementById('btnToggleEdges');

// Initial Load sync
loadShape(shapeSelect.value);

let edgesVisible = true;

if (btnToggleEdges) {
    btnToggleEdges.addEventListener('click', () => {
        edgesVisible = !edgesVisible;
        if (rootNode) {
            rootNode.traverse(child => {
                if (child.userData.isEdgeMarker && child.userData.hasPair) {
                    child.visible = edgesVisible;
                }
            });
        }
    });
}

shapeSelect.addEventListener('change', (e) => {
    loadShape(e.target.value);
    foldSlider.value = 0;
    targetProgress = 0;
    if (rootNode && !edgesVisible) {
        rootNode.traverse(child => {
            if (child.userData.isEdgeMarker && child.userData.hasPair) {
                child.visible = false;
            }
        });
    }
});

let targetProgress = 0;
let isAnimating = false;

function applyFoldProgress(p) {
    allHinges.forEach(hinge => {
        hinge.rotation.x = p * hinge.userData.targetFoldAngle;
    });
}

foldSlider.addEventListener('input', (e) => {
    isAnimating = false;
    targetProgress = parseFloat(e.target.value);
    applyFoldProgress(targetProgress);
});

btnFold.addEventListener('click', () => { isAnimating = true; targetProgress = 1; });
btnUnfold.addEventListener('click', () => { isAnimating = true; targetProgress = 0; });

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- ANIMATION LOOP ----
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    if (isAnimating) {
        const delta = clock.getDelta();
        const currentProgress = parseFloat(foldSlider.value);
        const diff = targetProgress - currentProgress;
        
        if (Math.abs(diff) > 0.001) {
            let newProgress = currentProgress + diff * 5 * delta;
            if (targetProgress === 1 && newProgress > 0.999) newProgress = 1;
            if (targetProgress === 0 && newProgress < 0.001) newProgress = 0;
            foldSlider.value = newProgress;
            applyFoldProgress(newProgress);
        } else {
            isAnimating = false;
        }
    } else {
        clock.getDelta();
    }

    renderer.render(scene, camera);
}
animate();
