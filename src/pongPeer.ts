import type {Socket} from "socket.io-client";
import {movePaddle,pongView,setPongDragging,tickPong,type PongState,type PongView,type Side} from "./pongPhysics";
import {paddleInputSchema,peerSignalSchema,pongStateSchema,type PaddleInput,type PeerSignal} from "./pongProtocol";

type Start={id:string;epoch:number;state:PongState;serverNow:number};
// One browser simulates the shared physics; the other sends inputs and renders
// snapshots. Socket.IO carries only negotiation and one recovery checkpoint/sec.
export class PongPeerSession{
 static supported(){return typeof RTCPeerConnection!=="undefined"&&window.isSecureContext&&!document.hidden;}
 private pc?:RTCPeerConnection;
 private channel?:RTCDataChannel;
 private control?:RTCDataChannel;
 private stopped=false;
 private failed=false;
 private running=false;
 private timer?:ReturnType<typeof setInterval>;
 private physics?:PongState;
 private clockOffset=0;
 private seq=0;
 private inputSeq=0;
 private remoteSeq=-1;
 private packetAt=performance.now();
 private checkpointAt=0;
 private frameAt=0;
 private stoppedWinner=false;
 private input:PaddleInput={y:.5,depth:-.1,forwardStroke:0};
 private dragging=false;
 private remoteInput?:{input:PaddleInput;active:boolean};
 private candidates:RTCIceCandidateInit[]=[];
 private signalQueue=Promise.resolve();
 private rateAt=performance.now();
 private rateCount=0;
 constructor(private socket:Socket,readonly id:string,readonly epoch:number,
  private side:Side,private host:Side,private update:(view:PongView)=>void){
  this.input.depth=side===0?-.1:1.1;
  socket.on("pong:signal",this.onSignal);
  socket.on("pong:peer-start",this.onStart);
  socket.on("disconnect",this.fail);
  document.addEventListener("visibilitychange",this.onVisibility);
  socket.emit("pong:peer-listening",{id,epoch});
  this.timer=setInterval(()=>this.step(),16);
  socket.timeout(6500).emit("pong:ice",{id},(error:Error|null,data:{iceServers:RTCIceServer[]})=>{
   if(this.stopped)return;
   if(error||!data?.iceServers){this.fail();return;}
   try{
    this.pc=new RTCPeerConnection({iceServers:data.iceServers});
    this.pc.onicecandidate=event=>{
     if(event.candidate)this.signal({type:"candidate",candidate:{...event.candidate.toJSON(),candidate:event.candidate.candidate}});
    };
    this.pc.onconnectionstatechange=()=>{
     if(this.pc?.connectionState==="failed"||this.pc?.connectionState==="closed")this.fail();
    };
    this.pc.ondatachannel=event=>this.attach(event.channel);
    if(this.side===this.host){
     this.attach(this.pc.createDataChannel("chat2play-pong",{ordered:false,maxRetransmits:0}));
     this.attach(this.pc.createDataChannel("chat2play-pong-inputs",{ordered:true}));
     void this.offer().catch(this.fail);
    }
    this.drainSignals?.();
   }catch{this.fail();}
  });
 }
 private drainSignals?:()=>void;
 private signal(signal:PeerSignal["signal"]){
  if(!this.stopped&&!this.failed)this.socket.emit("pong:signal",{id:this.id,epoch:this.epoch,signal});
 }
 private async offer(){
  const pc=this.pc!;
  await pc.setLocalDescription(await pc.createOffer());
  if(!this.stopped&&pc.localDescription)this.signal({type:"offer",sdp:pc.localDescription.sdp});
 }
 private onSignal=(raw:unknown)=>{
  const parsed=peerSignalSchema.safeParse(raw);
  if(!parsed.success||parsed.data.id!==this.id||parsed.data.epoch!==this.epoch||this.stopped)return;
  const {signal}=parsed.data;
  this.signalQueue=this.signalQueue.then(async()=>{
   if(this.stopped)return;
   if(!this.pc)await new Promise<void>(resolve=>{this.drainSignals=resolve;});
   const pc=this.pc;if(this.stopped||!pc)return;
   if(signal.type==="candidate"){
    if(pc.remoteDescription)await pc.addIceCandidate(signal.candidate);
    else this.candidates.push(signal.candidate);
   }else{
    if((signal.type==="offer")===(this.side===this.host))return;
    await pc.setRemoteDescription({type:signal.type,sdp:signal.sdp});
    for(const candidate of this.candidates.splice(0))await pc.addIceCandidate(candidate);
    if(signal.type==="offer"){
     await pc.setLocalDescription(await pc.createAnswer());
     if(!this.stopped&&pc.localDescription)this.signal({type:"answer",sdp:pc.localDescription.sdp});
    }
   }
  }).catch(this.fail);
 };
 private attach(channel:RTCDataChannel){
  const control=channel.label==="chat2play-pong-inputs";
  if(!control&&channel.label!=="chat2play-pong"){channel.close();return;}
  const existing=control?this.control:this.channel;
  if(existing&&existing!==channel){channel.close();return;}
  if(control)this.control=channel;else this.channel=channel;
  channel.onopen=()=>{
   if(!this.stopped&&this.channel?.readyState==="open"&&this.control?.readyState==="open")
    this.socket.emit("pong:peer-ready",{id:this.id,epoch:this.epoch});
  };
  channel.onclose=this.fail;channel.onerror=this.fail;
  channel.onmessage=event=>{
   if(this.stopped||!this.running||typeof event.data!=="string"||event.data.length>16_000)return;
   const perf=performance.now();
   if(perf-this.rateAt>1000){this.rateAt=perf;this.rateCount=0;}
   if(++this.rateCount>120)return;
   try{
    const packet=JSON.parse(event.data);
    if(!Number.isSafeInteger(packet.seq)||packet.seq<=this.remoteSeq)return;
    if(this.side===this.host&&packet.kind==="input"&&typeof packet.active==="boolean"){
     const parsed=paddleInputSchema.safeParse(packet.input);if(!parsed.success||!this.physics)return;
     this.remoteSeq=packet.seq;this.packetAt=perf;
     const other=this.side===0?1:0,now=Date.now()+this.clockOffset;
     const previous=this.remoteInput,input=parsed.data;
     if(!previous||previous.active!==packet.active)setPongDragging(this.physics,other,packet.active,now);
     // Idle heartbeats confirm liveness without repeatedly overwriting the
     // physics engine's gentle paddle assist or refreshing an expired swipe.
     if(!previous||input.y!==previous.input.y||input.depth!==previous.input.depth||input.forwardStroke!==previous.input.forwardStroke)
      movePaddle(this.physics,other,input,now);
     this.remoteInput={input,active:packet.active};
    }else if(this.side!==this.host&&packet.kind==="state"){
     const parsed=pongStateSchema.safeParse(packet.state);if(!parsed.success)return;
     this.remoteSeq=packet.seq;this.packetAt=perf;
     const view=pongView(parsed.data,parsed.data.lastTick);
     // Contact animations use the receiving device's wall clock.
     const offset=Date.now()-parsed.data.lastTick;
     view.lastHit=view.lastHit.map(value=>value?value+offset:0) as [number,number];
     this.update(view);
    }
   }catch{/* Ignore a malformed packet without changing the match. */}
  };
 }
 private onStart=(data:Start)=>{
  if(this.stopped||data.id!==this.id||data.epoch!==this.epoch)return;
  const parsed=pongStateSchema.safeParse(data.state);if(!parsed.success){this.fail();return;}
  this.clockOffset=data.serverNow-Date.now();this.physics=parsed.data;
  this.input={y:data.state.paddles[this.side],depth:data.state.depths[this.side],forwardStroke:0};
  this.running=true;this.packetAt=performance.now();this.checkpointAt=performance.now();
  this.update(pongView(parsed.data,data.serverNow));
 };
 private send(packet:unknown,control=false){
  const channel=control?this.control:this.channel;
  if(channel?.readyState!=="open")return;
  if(channel.bufferedAmount>64*1024){if(control)this.fail();return;}
  try{channel.send(JSON.stringify(packet));}catch{this.fail();}
 }
 move=(input:PaddleInput)=>{
  if(!this.running||this.failed)return;
  this.input=input;
  if(this.side===this.host&&this.physics)movePaddle(this.physics,this.side,input,Date.now()+this.clockOffset);
  else this.sendInput();
 };
 drag=(active:boolean)=>{
  this.dragging=active;
  if(active)this.input.forwardStroke=0;
  if(!this.running||this.failed)return;
  if(this.side===this.host&&this.physics)setPongDragging(this.physics,this.side,active,Date.now()+this.clockOffset);
  else this.sendInput();
 };
 private sendInput(){this.send({kind:"input",seq:++this.inputSeq,active:this.dragging,input:this.input},true);}
 private step(){
  if(!this.running||this.failed||this.stopped||!this.physics)return;
  const perf=performance.now(),now=Date.now()+this.clockOffset;
  if(perf-this.packetAt>3000){this.fail();return;}
  if(this.side===this.host){
   if(!this.stoppedWinner)this.stoppedWinner=tickPong(this.physics,now)!==null;
   else this.physics.lastTick=now;
   if(perf-this.frameAt>=32){
    this.frameAt=perf;
    const view=pongView(this.physics,now);
    view.lastHit=view.lastHit.map(value=>value?value-this.clockOffset:0) as [number,number];
    this.update(view);
    this.send({kind:"state",seq:++this.seq,state:this.physics});
   }
   if(perf-this.checkpointAt>=1000){
    this.checkpointAt=perf;
    this.socket.emit("pong:checkpoint",{id:this.id,epoch:this.epoch,seq:this.seq,state:this.physics});
   }
  }else if(perf-this.frameAt>=80){this.frameAt=perf;this.sendInput();}
 }
 private onVisibility=()=>{if(document.hidden)this.fail();};
 private fail=()=>{
  if(this.failed||this.stopped)return;
  this.failed=true;this.running=false;
  this.socket.emit("pong:peer-failed",{id:this.id,epoch:this.epoch});
 };
 close(){
  if(this.stopped)return;this.stopped=true;this.running=false;
  if(this.timer)clearInterval(this.timer);
  this.drainSignals?.();
  this.socket.off("pong:signal",this.onSignal);this.socket.off("pong:peer-start",this.onStart);
  this.socket.off("disconnect",this.fail);document.removeEventListener("visibilitychange",this.onVisibility);
  this.channel?.close();this.control?.close();this.pc?.close();
 }
}
