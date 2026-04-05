const testGen = () => {
    let validNets = [];
    let seenShapes = new Set();
    
    const getCoords = (tree) => {
        let pts = [{cx:0, cy:0, rot:0}]; 
        const addNode = (n, px, py, prot) => {
            for(let c of n.children){
                if (!c.id) continue;
                let ang = (prot + c.edge * 120 + 90) * Math.PI / 180;
                let nx = px + Math.cos(ang);
                let ny = py + Math.sin(ang);
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
        let reps = [];
        for(let reflect=0; reflect<2; reflect++){
            for(let a=0; a<6; a++){
                let cos = Math.cos(a*Math.PI/3), sin = Math.sin(a*Math.PI/3);
                let trans = pts.map(p => {
                    let cx = reflect ? -p.cx : p.cx;
                    let cy = p.cy;
                    return { x: Math.round((cx*cos - cy*sin)*100)/100, y: Math.round((cx*sin + cy*cos)*100)/100 };
                });
                let minx = Math.min(...trans.map(p=>p.x));
                let miny = Math.min(...trans.map(p=>p.y));
                let norm = trans.map(p=>`${(p.x-minx).toFixed(2)}_${(p.y-miny).toFixed(2)}`).sort().join('|');
                reps.push(norm);
            }
        }
        return reps.sort()[0];
    };

    let idCtr = 1;
    let colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#eab308', '#0d9488', '#059669', '#3b82f6'];
    globalThis.colors = colors; 
    
    const search = (nodeStrTpl, numNodes, facesSet, availSlots) => {
        if(numNodes === 8){
            let tree = eval(`(${nodeStrTpl})`);
            let hash = normalize(tree);
            if(!seenShapes.has(hash)){
                seenShapes.add(hash);
                validNets.push(tree);
                console.log("Found shape:", validNets.length);
            }
            return;
        }

        for(let i=0; i<availSlots.length; i++){
            let slot = availSlots[i];
            let state = slot.state;
            let d = slot.edge;
            
            let nState;
            if(d===0) nState = [-state[0], state[2], state[1]];
            if(d===1) nState = [-state[1], state[0], state[2]];
            if(d===2) nState = [-state[2], state[1], state[0]];
            
            let faceStr = [...nState].sort((a,b) => Math.abs(a) - Math.abs(b)).map(Math.sign).join('');
            if(!facesSet.has(faceStr)){
                let nFaces = new Set(facesSet);
                nFaces.add(faceStr);
                
                let nSlots = [...availSlots];
                nSlots.splice(i, 1);
                
                let childId = numNodes;
                let cStr = `{ id: 'O_${idCtr}_${childId}', type: 'triangle', color: colors[${childId}], edge: ${d}, foldAngle: -Math.acos(1/3), children: [] }`;
                
                let nTpl = nodeStrTpl.replace(`/*SLOT_${slot.id}*/`, cStr + `, /*SLOT_${childId}_new*/ /*SLOT_${slot.id}*/`);
                let nTpl2 = nTpl.replace(`/*SLOT_${childId}_new*/`, `/*SLOT_C${childId}_1*/ /*SLOT_C${childId}_2*/`);
                
                nSlots.push({ id: `C${childId}_1`, edge: 1, state: nState });
                nSlots.push({ id: `C${childId}_2`, edge: 2, state: nState });
                
                search(nTpl2, numNodes+1, nFaces, nSlots);
            }
        }
    };

    let rootState = [1, 2, 3];
    let slots = [
        { id: 'R_0', edge: 0, state: rootState },
        { id: 'R_1', edge: 1, state: rootState },
        { id: 'R_2', edge: 2, state: rootState }
    ];
    let rootTpl = `{ id: 'O_${idCtr}_0', type: 'triangle', color: colors[0], children: [ /*SLOT_R_0*/ /*SLOT_R_1*/ /*SLOT_R_2*/ ] }`;
    let initFaces = new Set([[1,1,1].join('')]);
    
    search(rootTpl, 1, initFaces, slots);

    console.log("Total unique valid nets:", validNets.length);
    let output = "";
    validNets.forEach((net, i) => {
        const cleanTree = (n) => {
            let res = { id: n.id, type: n.type, color: n.color, children: [] };
            if(n.edge !== undefined) {
                res.edge = n.edge;
                res.foldAngle = n.foldAngle;
            }
            for(let c of n.children) if(c.id) res.children.push(cleanTree(c));
            return res;
        };
        output += `    oct_net_${i+1}: { defaultType: 'triangle', foldAngle: -Math.acos(1/3), net: ${JSON.stringify(cleanTree(net)).replace(/"([^(")"]+)":/g,"$1:")} },\n`;
    });
    const fs = require('fs');
    fs.writeFileSync('generated_nets.txt', output);
};

testGen();
