import {lazy,Suspense,useEffect,useRef,useState} from "react";
import {ArrowLeft,Gamepad2,LoaderCircle,Trophy,Volume2,VolumeX,X} from "lucide-react";
import type {Choice,Game,Side} from "./Pieces";
import {playRpsBeat,unlockRpsAudio} from "./rpsAudio";
import {RPS_BEAT_MS,RPS_CHANT_MS,RPS_LAND_MS,RPS_REVEAL_MS} from "./rpsTiming";
import {RpsSignIcon} from "./RpsSignIcon";
import "./rps-full.css";

const RpsScene3D=lazy(()=>import("./RpsScene3D"));

type Props={game:Game;side:Side;onMove:(choice:Choice)=>void;onReady:()=>void;
 onBack:()=>void;onClose:()=>void;onReplay:()=>void;questionPending:boolean};

export default function RpsFullView({game,side,onMove,onReady,onBack,onClose,onReplay,questionPending}:Props){
 const [view,setView]=useState<"pov"|"arena">("pov");
 const [selected,setSelected]=useState<Choice|null>(null);
 const [clockNow,setClockNow]=useState(Date.now());
 const [soundOn,setSoundOn]=useState(()=>localStorage.getItem("c2p:rps-sound")!=="off");
 const backButton=useRef<HTMLButtonElement>(null);
 const lastCue=useRef("");
 const rps=game.rps,paused=Boolean(rps?.pausedBy.some(Boolean));
 const rematch=rps?.rematch;
 useEffect(()=>{setSelected(null);},[game.id,game.rps?.round]);
 useEffect(()=>{
  if((game.phase!=="playing"&&!rematch)||paused)return;
  setClockNow(Date.now());
  const timer=window.setInterval(()=>setClockNow(Date.now()),60);
  return()=>window.clearInterval(timer);
 },[game.phase,paused,rematch?.expiresAt]);
 useEffect(()=>{localStorage.setItem("c2p:rps-sound",soundOn?"on":"off");},[soundOn]);
 useEffect(()=>{
  const previous=document.body.style.overflow;document.body.style.overflow="hidden";
  backButton.current?.focus();
  return()=>{document.body.style.overflow=previous;};
 },[]);
 const other=side===0?1:0;
 const displayNow=paused?(rps?.pauseAt??clockNow):clockNow;
 const rematchSeconds=rematch?Math.max(0,Math.ceil((rematch.expiresAt-clockNow)/1000)):0;
 const choosing=game.phase==="playing"&&game.rps?.stage==="choosing";
 const seconds=choosing?Math.max(0,Math.ceil(((game.rps?.roundEndsAt??0)-displayNow)/1000)):0;
 const chantElapsed=rps?.stage==="chant"?Math.max(0,Math.min(RPS_CHANT_MS,RPS_CHANT_MS-(rps.chantEndsAt-displayNow))):0;
 const chantReady=rps?.stage==="chant"&&rps.chantEndsAt-displayNow<=RPS_CHANT_MS;
 const revealElapsed=rps?.stage==="reveal"||game.phase==="finished"?
  Math.max(0,RPS_REVEAL_MS-(rps?.revealEndsAt??displayNow)+displayNow):0;
 const beat=chantReady?Math.min(1,Math.floor(chantElapsed/RPS_BEAT_MS)):
  rps?.stage==="reveal"&&revealElapsed<RPS_LAND_MS?2:null;
 const word=beat===null?null:beat===2?"Pick!":"Bato!";
 const landed=game.phase==="finished"||(rps?.stage==="reveal"&&revealElapsed>=RPS_LAND_MS);
 useEffect(()=>{
  if(paused||beat===null||!rps)return;
  const cue=`${game.id}:${rps.round}:${beat}`;
  if(lastCue.current===cue)return;
  lastCue.current=cue;
  const beatAge=beat===2?revealElapsed:chantElapsed-beat*RPS_BEAT_MS;
  if(beatAge<(beat===2?600:RPS_BEAT_MS-150))playRpsBeat(beat as 0|1|2,soundOn);
 },[game.id,rps?.round,paused,beat,chantElapsed,revealElapsed,soundOn]);
 const backDisabled=game.phase==="loading"&&!game.sceneReady?.[side];
 const status=paused?game.rps?.pausedBy[other]?"Game paused · Your partner is outside the game":"Game paused · You are outside the game":
  game.phase==="loading"?"Preparing both players' 3D scene…":
  rematch?rematch.accepted[side]?`Waiting for your partner · ${rematchSeconds}s`:`Your partner wants a rematch · ${rematchSeconds}s to accept`:
  game.phase==="finished"?game.winner===side?"MATCH WINNER!":"Your partner wins the match":
  game.rps?.stage==="chant"?"Get ready to throw…":
  game.rps?.stage==="reveal"&&!landed?"Throw on Pick!":
  game.rps?.stage==="reveal"?game.rps.roundWinner==="draw"?"Tie round":
   game.rps.roundWinner===side?"You won this round!":"Your partner won this round":
  game.ready[side]?"Locked in. Waiting for the reveal…":
  `Round ${game.rps?.round??1} · Choose before time runs out`;
 return <section className="rps-full-overlay" role="dialog" aria-modal="true" aria-label="Rock Paper Scissors" onPointerDownCapture={unlockRpsAudio}>
  <div className="rps-full-scene">
   <Suspense fallback={<div className="rps-full-scene-loading" role="status">Loading 3D characters…</div>}>
    <RpsScene3D side={side} view={view} ownChoice={selected} reveal={game.reveal} gameId={game.id}
      round={game.rps?.round??1} stage={rps?.stage} chantEndsAt={rps?.chantEndsAt}
      revealEndsAt={rps?.revealEndsAt} pauseAt={rps?.pauseAt} onReady={onReady}/>
   </Suspense>
  </div>
  <div className="rps-full-gradient" aria-hidden="true"/>
  <header className="rps-full-header">
   <button ref={backButton} type="button" className="rps-full-back" onClick={onBack} disabled={backDisabled} aria-label="Back to chat">
    <ArrowLeft size={20}/><span>Back to chat</span>
   </button>
   <strong>Rock Paper Scissors</strong>
   <div className="rps-full-header-actions">
    <button type="button" className="rps-full-sound" onClick={()=>setSoundOn(value=>!value)} aria-label={soundOn?"Mute game sounds":"Enable game sounds"} aria-pressed={soundOn}>{soundOn?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>
    <button type="button" className="rps-full-end" onClick={onClose} aria-label="End game"><X size={18}/><span>End game</span></button>
   </div>
  </header>
  <div className="rps-full-scores rps-stage-hud" aria-label="Match score">
   <span>YOU {game.rps?.scores[side]??0}</span>
   <span>{choosing?`${seconds}s`:"VS"}</span>
   <span>{game.rps?.scores[other]??0} PARTNER</span>
  </div>
  <div className="rps-full-view-switch rps-view-switch" role="group" aria-label="Game view">
   <button type="button" aria-pressed={view==="pov"} onClick={()=>setView("pov")}>First-person</button>
   <button type="button" aria-pressed={view==="arena"} onClick={()=>setView("arena")}>Arena view</button>
  </div>
  <p className={"rps-full-status rps-stage-status"+(paused?" is-paused":"")} aria-live="polite">{status}</p>
  {choosing&&<div className="rps-countdown rps-full-countdown" aria-label="Choose before timer ends">{seconds}</div>}
  {word&&beat!==null&&<div className="rps-chant-word" role="status" aria-live="assertive" data-beat={beat+1}>
   <span key={`${rps?.round}-${beat}`} aria-label={`Beat ${beat+1}: ${word}`}>{word}</span>
  </div>}
  {game.phase==="loading"&&<div className="rps-loading-overlay rps-full-loading" role="status">
   <LoaderCircle className="spinner" size={30}/><strong>Loading 3D studio</strong>
   <small>Both players must finish loading before the countdown</small>
   <span>YOU {game.sceneReady?.[side]?"READY":"LOADING"} · PARTNER {game.sceneReady?.[other]?"READY":"LOADING"}</span>
  </div>}
  <div className="rps-full-bottom">
   {game.reveal&&landed&&<div className="rps-full-result" aria-label="Round choices">
    <span>You: <b>{game.reveal.choices[side]??"No move"}</b></span>
    <span>Partner: <b>{game.reveal.choices[other]??"No move"}</b></span>
   </div>}
   {game.phase==="finished"&&<div className="rps-full-finish"><Trophy size={18}/><span>{game.winner===side?"You won the match!":"Match complete"}</span>
    {questionPending?<small>{game.winner===side?"Ask your question before a rematch":"Answer the winner's question before a rematch"}</small>:rematch?.accepted[side]?<small>Waiting for partner · {rematchSeconds}s</small>:
     <button type="button" onClick={onReplay}><Gamepad2 size={15}/>{rematch?`Accept rematch · ${rematchSeconds}s`:"Request rematch"}</button>}
    <button type="button" className="rps-finish-back" onClick={onBack}><ArrowLeft size={15}/> {questionPending?game.winner===side?"Ask in chat":"Answer in chat":"Back to chat"}</button></div>}
   {game.phase==="playing"&&<div className="rps-full-choices rps-grid" aria-label="Choose a rock paper scissors move">
    {(["rock","paper","scissors"] as Choice[]).map(choice=><button type="button" className="rps-tile" key={choice}
      onClick={()=>{setSelected(choice);onMove(choice);}} aria-label={`Choose ${choice}`} aria-pressed={selected===choice}
      disabled={!choosing||paused||game.ready[side]}>
      <RpsSignIcon choice={choice}/><span>{choice}</span>
    </button>)}
   </div>}
  </div>
 </section>;
}
