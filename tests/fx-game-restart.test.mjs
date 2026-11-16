import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
test('recreated games register their own effect animations even when shared module metadata survives',()=>{
 const code=ts.transpileModule(fs.readFileSync('src/game/fx/pixelfxBridge.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,module={exports:{}};
 vm.runInNewContext(`(function(require,module,exports){${code}})`,{})(id=>{if(id==='phaser')return{};if(id.endsWith('/assetSelection'))return{};throw Error(id);},module,module.exports);
 const meta={meta:{pixelfx:{fps:30,loop:false}}},texture={key:'hit-spark',getFrameNames:()=>['hit-spark 0','hit-spark 1']};
 function scene(){const animations=new Map();return{textures:{exists:()=>true,get:()=>texture},cache:{json:{get:()=>meta}},anims:{exists:k=>animations.has(k),create:a=>animations.set(a.key,a)}};}
 const a=scene(),b=scene();module.exports.registerFxSheet(a,'hit-spark');assert.equal(a.anims.exists('hit-spark-play'),true);
 module.exports.registerFxSheet(b,'hit-spark');assert.equal(b.anims.exists('hit-spark-play'),true,'a new game needs its own animation registration');
});
