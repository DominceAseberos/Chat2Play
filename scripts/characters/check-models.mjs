import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const validator=require('./validation-tools/node_modules/gltf-validator');
const required=['Idle','Walk','Blink','Happy','Sad','Surprised','Celebrate','VictoryDance','NodYes','ShakeNo','LookLeft','LookRight','Sit','Stand','RaiseArms','LowerArms','RPSAnticipation','RPSPump','Rock','Paper','Scissors','Throw','Lose','POVReady','POVPump','POVThrow','POVRock','POVPaper','POVScissors'];
for(const name of ['female','male']){
 const b=await fs.readFile(new URL(`../../public/models/characters/${name}.glb`,import.meta.url));
 const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 const validation=await validator.validateBytes(new Uint8Array(b),{maxIssues:200});
 assert.equal(validation.issues.numErrors,0,`${name}: ${JSON.stringify(validation.issues.messages)}`);
 const clips=j.animations.map(a=>a.name);assert.deepEqual([...clips].sort(),[...required].sort());
 assert.equal(j.skins.length,1);assert.equal(j.skins[0].joints.length,38);assert.equal(j.materials.length,1);
 const primitive=j.meshes[0].primitives[0];assert.equal(primitive.targets.length,4);
 assert.ok(primitive.attributes.COLOR_0!==undefined&&primitive.attributes.JOINTS_0!==undefined&&primitive.attributes.WEIGHTS_0!==undefined);
 const triangles=j.accessors[primitive.indices].count/3;assert.ok(triangles>=5000&&triangles<=12000);
 const result={name,bytes:b.length,triangles,joints:38,drawCallsPerCharacter:1,clips,validator:validation.issues};
 await fs.writeFile(new URL(`../../assets/characters/validation/${name}-gltf.json`,import.meta.url),JSON.stringify(result,null,2));
 console.log('PASS',name,b.length,'bytes',triangles,'triangles',clips.length,'clips',validation.issues.numWarnings,'warnings');
}
