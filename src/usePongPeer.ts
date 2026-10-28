import {useEffect,useMemo,useRef} from "react";
import type {Socket} from "socket.io-client";
import type {Game,Side} from "./Pieces";
import type {PaddleInput} from "./pongProtocol";
import type {PongView} from "./pongPhysics";
import type {PongPeerSession} from "./pongPeer";

export type PongFrames={subscribe:(listener:()=>void)=>()=>void;getSnapshot:()=>PongView|undefined};

export function usePongPeer(socket:Socket,game:Game|null,side:Side){
 const session=useRef<PongPeerSession|null>(null);
 const current=useRef(game);current.current=game;
 const id=game?.kind==="pong"?game.id:undefined,epoch=game?.pongNetwork?.epoch??0;
 // Only the game view subscribes to frequent snapshots; the surrounding chat
 // does not re-render for every ball update.
 const frames=useMemo(()=>{
  let frame:PongView|undefined;const listeners=new Set<()=>void>();
  return {getSnapshot:()=>frame,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
   publish:(next:PongView)=>{frame=next;listeners.forEach(listener=>listener());}};
 },[id,epoch]);
 const host=game?.pongNetwork?.host??0;
 const enabled=Boolean(id&&game?.phase==="playing"&&game.pongNetwork?.mode!=="server"&&game.pongNetwork);
 useEffect(()=>{
  if(!enabled||!id)return;
  let disposed=false,peer:PongPeerSession|undefined;
  void import("./pongPeer").then(({PongPeerSession})=>{
   if(disposed)return;
   peer=new PongPeerSession(socket,id,epoch,side,host,frames.publish);
   session.current=peer;
  }).catch(()=>{if(!disposed)socket.emit("pong:peer-failed",{id,epoch});});
  return()=>{disposed=true;peer?.close();if(session.current===peer)session.current=null;};
 },[socket,id,epoch,enabled,side,host,frames]);
 return {
  frames,
  move:(input:PaddleInput)=>{
   if(current.current?.pongNetwork?.mode==="peer")session.current?.move(input);
   else if(current.current?.pongNetwork?.mode!=="connecting"&&socket.connected)socket.emit("pong:paddle",input);
  },
  drag:(active:boolean)=>{
   if(current.current?.pongNetwork?.mode==="peer")session.current?.drag(active);
   else if(current.current?.pongNetwork?.mode!=="connecting"&&socket.connected)socket.emit("pong:drag",{id:current.current?.id,active});
  },
  sceneReady:()=>{if(socket.connected)socket.emit("pong:scene-ready",{id:current.current?.id,
   peer:typeof RTCPeerConnection!=="undefined"&&window.isSecureContext&&!document.hidden});}
 };
}
