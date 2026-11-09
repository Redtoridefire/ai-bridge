"use strict";
// A local protocol fixture verifies integration without downloading a model.
const http=require('node:http');
const assert=require('node:assert/strict');
const {evaluate}=require('./renderer-smoke');
async function main(){
  const requests=[];
  const server=http.createServer((req,res)=>{
    let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
      requests.push({path:req.url,body:body?JSON.parse(body):null});
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify(req.url==='/api/tags'?{models:[{name:'fixture-model'}]}:{response:'Fixture local summary'}));
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(11434,'127.0.0.1',resolve);});
  try{
    const targets=await fetch(`http://127.0.0.1:${process.env.CDP_PORT||9225}/json`).then(r=>r.json());
    const target=targets.find(item=>item.type==='page'&&item.url.includes('index.html'));
    const result=await evaluate(target.webSocketDebuggerUrl,`(async()=>{
      const models=await bridge.ollama({action:'models'});
      const output=await bridge.ollama({action:'generate',model:'fixture-model',prompt:'Summarize only this selected text.'});
      const rejected=await bridge.ollama({action:'generate',model:'fixture-model',prompt:42});
      return {models,output,rejected};
    })()`);
    assert.equal(result.models.data.models[0].name,'fixture-model');assert.equal(result.output.data.response,'Fixture local summary');assert.equal(result.rejected.ok,false);
    assert.equal(requests[1].body.stream,false);assert.equal(requests[1].body.prompt,'Summarize only this selected text.');
    console.log('Ollama IPC integration passed with local protocol fixture (no real model inference).');
  }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
