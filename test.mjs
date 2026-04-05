import * as THREE from 'three';

const s = 10;
const h = s * Math.sqrt(3) / 2;

const netDefinition = {
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
};

const allHinges = [];
const meshes = [];

function buildNet(nodeDef) {
    const faceGroup = new THREE.Group();
    const mesh = new THREE.Mesh();
    faceGroup.add(mesh);
    meshes.push({ id: nodeDef.id, mesh });

    nodeDef.children.forEach(childDef => {
        const hinge = new THREE.Group();
        hinge.rotation.order = 'ZYX';
        
        if (childDef.edge === 0) {
            hinge.position.set(s, 0, 0);
            hinge.rotation.z = Math.PI;
        } else if (childDef.edge === 1) {
            hinge.position.set(s / 2, h, 0);
            hinge.rotation.z = Math.PI + Math.atan2(h, -s/2); 
        } else if (childDef.edge === 2) {
            hinge.position.set(0, 0, 0);
            hinge.rotation.z = Math.PI + Math.atan2(-h, -s/2);
        }

        const childGroup = buildNet(childDef);
        hinge.add(childGroup);
        faceGroup.add(hinge);
        allHinges.push(hinge);
    });

    return faceGroup;
}

const rootNode = buildNet(netDefinition);
rootNode.position.set(-s/2, 0, 0);
rootNode.updateMatrixWorld(true);

const MAX_FOLD_ANGLE = -Math.acos(1 / 3);
// Apply folding
allHinges.forEach(h => h.rotation.x = MAX_FOLD_ANGLE);
rootNode.updateMatrixWorld(true);

const geometryPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(s, 0, 0),
    new THREE.Vector3(s/2, h, 0)
];

meshes.forEach(({id, mesh}) => {
    // update matrix world to make sure all positions are fresh
    mesh.updateMatrixWorld(true);
    console.log(`Face ${id}:`);
    geometryPoints.forEach((p, i) => {
        const wp = p.clone().applyMatrix4(mesh.matrixWorld);
        // Clean up negative zeroes
        const x = Math.abs(wp.x) < 1e-4 ? 0 : wp.x;
        const y = Math.abs(wp.y) < 1e-4 ? 0 : wp.y;
        const z = Math.abs(wp.z) < 1e-4 ? 0 : wp.z;
        console.log(`  V${i}: ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`);
    });
});
