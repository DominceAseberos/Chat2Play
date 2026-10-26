import {useEffect,useRef,useState} from "react";
import {Mic,MicOff,Volume2,VolumeX,Headphones,Check,LoaderCircle,ShieldCheck,AlertCircle} from "lucide-react";
import type {Socket} from "socket.io-client";
import type {Game,Side} from "./Pieces";
import "./henyoVoice.css";

type Signal={id:string;type:"offer"|"answer"|"candidate";sdp?:string;candidate?:RTCIceCandidateInit};
type Props={game:Game;side:Side;socket:Socket;onLeave:()=>void};
export default function HenyoVoice({game,side,socket,onLeave}:Props){
 const streamRef=useRef<MediaStream|null>(null);
 const peerRef=useRef<RTCPeerConnection|null>(null);
 const pendingIce=useRef<RTCIceCandidateInit[]>([]);
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const alive=useRef(true);
 const offerStarted=useRef(false);
 const [permission,setPermission]=useState<"idle"|"requesting"|"granted"|"error">("idle");
 const [error,setError]=useState("");
 const [voice,setVoice]=useState("Waiting for microphones");
 const [speakerMuted,setSpeakerMuted]=useState(false);
 const [needsAudioTap,setNeedsAudioTap]=useState(false);
 const allReady=game.micReady?.every(Boolean)??false;
 const isGuesser=game.phase==="playing"&&game.forehead?.turn===side;
 const canTransmit=Boolean(isGuesser&&permission==="granted");
 // Immediately disable sending whenever the authoritative active role changes.
 // Permission remains granted so turns can change without a new browser prompt.
 useEffect(()=>{
  for(const track of streamRef.current?.getAudioTracks()??[])track.enabled=canTransmit;
 },[canTransmit]);
 // A real user click is required for getUserMedia and mobile audio unlock.
 async function enableMic(){
  if(streamRef.current||permission==="requesting")return;
  setPermission("requesting");setError("");
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==="undefined")
    throw new Error("This browser does not support microphone calls. Open the HTTPS link in Chrome, Edge or Safari.");
   const stream=await navigator.mediaDevices.getUserMedia({
    video:false,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}
   });
   if(!alive.current){stream.getTracks().forEach(t=>t.stop());return;}
   // Permission is NOT permission to broadcast. Silence both streams until
   // the server starts the match and assigns this player as the guesser.
   stream.getAudioTracks().forEach(t=>{t.enabled=false;});
   streamRef.current=stream;
   stream.getAudioTracks().forEach(t=>{t.onended=()=>{
    if(!alive.current)return;
    setPermission("error");setError("Microphone stopped. Leave this match and start a new one to reconnect.");
    setVoice("Microphone disconnected");
   };});
   setPermission("granted");
   socket.emit("forehead:mic-ready",{id:game.id});
  }catch(err){
   if(!alive.current)return;
   setPermission("error");
   const e=err instanceof Error?err.message:String(err);
   setError(e.includes("Permission denied")||e.includes("NotAllowedError")||e.includes("Permission dismissed")
    ?"Microphone access was blocked. Allow it in your browser's site permissions, then try again."
    :e);
  }
 }
 function makePeer():RTCPeerConnection{
  if(peerRef.current)return peerRef.current;
  const pc=new RTCPeerConnection({iceServers:[
   {urls:"stun:stun.l.google.com:19302"},
   {urls:"stun:stun1.l.google.com:19302"}
  ]});
  peerRef.current=pc;
  for(const track of streamRef.current?.getAudioTracks()??[])pc.addTrack(track,streamRef.current!);
  pc.onicecandidate=e=>{
   if(e.candidate)socket.emit("forehead:voice:signal",{
    id:game.id,type:"candidate",candidate:e.candidate.toJSON()
   });
  };
  pc.ontrack=e=>{
   const remote=e.streams[0]??new MediaStream([e.track]);
   if(audioRef.current){
    audioRef.current.srcObject=remote;
    void audioRef.current.play().then(()=>setNeedsAudioTap(false))
      .catch(()=>{setNeedsAudioTap(true);setVoice("Tap Enable audio to hear your partner");});
   }
   setVoice("Voice connected");
  };
  pc.onconnectionstatechange=()=>{
   if(pc.connectionState==="connected")setVoice("Voice connected");
   else if(pc.connectionState==="failed")setVoice("Voice connection failed — try another network");
   else if(pc.connectionState==="disconnected")setVoice("Reconnecting voice…");
   else if(pc.connectionState==="connecting")setVoice("Connecting voice…");
  };
  return pc;
 }
 useEffect(()=>{
  alive.current=true;
  const onSignal=async(data:Signal)=>{
   if(data.id!==game.id||!streamRef.current||!["offer","answer","candidate"].includes(data.type))return;
   try{
    if(data.type==="candidate"){
     if(!data.candidate)return;
     if(!peerRef.current?.remoteDescription)pendingIce.current.push(data.candidate);
     else await peerRef.current.addIceCandidate(data.candidate);
     return;
    }
    const pc=makePeer();
    if(!data.sdp)return;
    await pc.setRemoteDescription({type:data.type,sdp:data.sdp});
    for(const candidate of pendingIce.current.splice(0))await pc.addIceCandidate(candidate);
    if(data.type==="offer"){
     const answer=await pc.createAnswer();
     await pc.setLocalDescription(answer);
     socket.emit("forehead:voice:signal",{id:game.id,type:"answer",sdp:pc.localDescription?.sdp});
    }
   }catch{setVoice("Unable to negotiate voice call");}
  };
  socket.on("forehead:voice:signal",onSignal);
  return()=>{
   alive.current=false;
   socket.off("forehead:voice:signal",onSignal);
   peerRef.current?.close();peerRef.current=null;
   streamRef.current?.getTracks().forEach(track=>{track.onended=null;track.stop();});
   streamRef.current=null;
   if(audioRef.current)audioRef.current.srcObject=null;
  };
 // The game ID stays stable during mic authorization, loading, and gameplay.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[game.id,socket]);
 useEffect(()=>{
  if(!allReady||permission!=="granted"||game.phase==="mic"||offerStarted.current||side!==0)return;
  offerStarted.current=true;
  const start=async()=>{
   try{
    const pc=makePeer();
    setVoice("Connecting voice…");
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("forehead:voice:signal",{id:game.id,type:"offer",sdp:pc.localDescription?.sdp});
   }catch{setVoice("Voice connection failed");}
  };
  void start();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[allReady,permission,side,game.phase,game.id]);
 useEffect(()=>{if(audioRef.current)audioRef.current.muted=speakerMuted;},[speakerMuted]);
 const selfReady=Boolean(game.micReady?.[side]);
 const partnerReady=Boolean(game.micReady?.[side===0?1:0]);
 const waiting=game.phase==="mic";
 return <>
  <audio ref={audioRef} autoPlay playsInline data-henyo-remote-audio aria-label="Partner voice audio"/>
  {waiting?<div className="henyo-mic-overlay" role="dialog" aria-label="Pinoy Henyo microphone permission" aria-modal="true">
   <div className="henyo-mic-card">
    <div className="henyo-mic-emblem"><Mic size={28}/></div>
    <h2>Enable microphones</h2>
    <p>Both players grant microphone access, but only the current guesser can speak. The hint giver stays muted and answers using head nods and shakes.</p>
    <div className="henyo-mic-participants">
     <span className={selfReady?"ready":""}>{selfReady?<Check size={16}/>:<Mic size={16}/>} You: {selfReady?"Ready":"Waiting"}</span>
     <span className={partnerReady?"ready":""}>{partnerReady?<Check size={16}/>:<LoaderCircle size={16}/>} Partner: {partnerReady?"Ready":"Waiting"}</span>
    </div>
    {permission!=="granted"&&<button className="henyo-mic-allow" type="button" onClick={()=>void enableMic()} disabled={permission==="requesting"}>
     {permission==="requesting"?<LoaderCircle size={17} className="henyo-spin"/>:<Mic size={17}/>}
     {permission==="requesting"?"Requesting microphone…":"Allow microphone"}
    </button>}
    {permission==="granted"&&<p className="henyo-mic-waiting" role="status">
     <Check size={17}/> {partnerReady?"Both microphones enabled. Opening studio…":"Your microphone is ready. Waiting for your partner to allow theirs…"}
    </p>}
    {error&&<p className="henyo-mic-error" role="alert"><AlertCircle size={16}/>{error}</p>}
    <p className="henyo-mic-privacy"><ShieldCheck size={13}/> Microphone permission stays under your browser's control. Voice is not recorded by Chat2Play.</p>
    <button type="button" className="henyo-mic-leave" onClick={onLeave}>Cancel game</button>
   </div>
  </div>:<div className="henyo-voice-dock" role="group" aria-label="Pinoy Henyo voice controls" data-voice-state={voice}>
    <span className="henyo-voice-indicator"><Headphones size={14}/>{voice}</span>
    <span className={"henyo-role-mic "+(canTransmit?"speaking":"locked")} role="status" aria-label={canTransmit?"Your microphone is on: you are guessing":"Your microphone is muted: you are giving hints"}>
     {canTransmit?<><Mic size={15}/> YOU SPEAK</>:<><MicOff size={15}/> MUTED</>}
    </span>
    <button type="button"
      title={needsAudioTap?"Enable partner audio":speakerMuted?"Unmute partner audio":"Mute partner audio"}
      aria-label={needsAudioTap?"Enable partner audio":speakerMuted?"Unmute partner audio":"Mute partner audio"}
      onClick={()=>{
       if(needsAudioTap){
        if(audioRef.current){
         audioRef.current.muted=false;
         void audioRef.current.play().then(()=>{
          setNeedsAudioTap(false);setSpeakerMuted(false);setVoice("Voice connected");
         }).catch(()=>setVoice("Audio blocked by browser settings"));
        }
       }else{
        const next=!speakerMuted;setSpeakerMuted(next);
        if(audioRef.current){
         audioRef.current.muted=next;
         if(!next)void audioRef.current.play().catch(()=>{setNeedsAudioTap(true);});
        }
       }
      }}>
      {speakerMuted&&!needsAudioTap?<VolumeX size={17}/>:<Volume2 size={17}/>}
    </button>
   </div>}
 </>;
}
