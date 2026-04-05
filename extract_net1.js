import fs from 'fs';

let injectionStr = fs.readFileSync('main.js', 'utf8');
let solidsObj = {};
const match = injectionStr.match(/oct_net_1:[\s\S]*?oct_net_11:[\s\S]*?}\s*}/);
if(match) eval('solidsObj = {' + match[0] + '}');

import { execSync } from 'child_process';
fs.writeFileSync('temp.txt', JSON.stringify(solidsObj.oct_net_1.net));

