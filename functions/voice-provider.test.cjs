const test=require('node:test');
const assert=require('node:assert/strict');
const {parseCallResult,parseBalance,publicHttpsEndpoint,requestVoiceApi}=require('./voice-provider.cjs');

test('parses common nested call-result samples into a stable voice-call record',()=>{
  assert.deepEqual(parseCallResult({data:{status:'completed',call_id:'call-9',duration:'34',user_response:'1'}}),{
    status:'confirmed',providerStatus:'completed',callId:'call-9',duration:34,userResponse:'1',
  });
  assert.equal(parseCallResult({result:{status:'cancelled',key_press:2}}).status,'cancelled');
  assert.equal(parseCallResult({status:'busy'}).status,'failed');
  assert.equal(parseCallResult({status:'ringing'}).status,'in-progress');
});

test('parses provider balance and blocks unsafe or incomplete endpoints',async()=>{
  assert.deepEqual(parseBalance({data:{available_balance:'81.5',currency:'PKR'}}),{available:true,balance:81.5,currency:'PKR'});
  assert.equal(parseBalance({message:'unavailable'}).available,false);
  assert.equal(publicHttpsEndpoint('http://localhost/internal'),'');
  assert.equal(publicHttpsEndpoint('https://voice.example/api'),'https://voice.example/api');
  let called=false;
  const original=global.fetch;
  global.fetch=async()=>{called=true;return {ok:true,status:200,text:async()=>'{\"status\":\"queued\"}'};};
  try{
    assert.deepEqual(await requestVoiceApi({endpoint:'https://voice.example/call',token:''}),{configured:false,status:0,data:null});
    assert.equal(called,false);
    const result=await requestVoiceApi({endpoint:'https://voice.example/call',token:'configured-secret',body:{phone:'+923001234567'}});
    assert.equal(result.configured,true);
    assert.equal(result.data.status,'queued');
  }finally{global.fetch=original;}
});
