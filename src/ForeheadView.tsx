import {useEffect,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,Check,SkipForward,Sparkles,Gamepad2,Trophy,X,Mic} from "lucide-react";
import ForeheadScene from "./ForeheadScene";

import type {Socket} from "socket.io-client";
import type {Game,Side,Kind,ChatMessage} from "./Pieces";
import "./forehead.css";

type Props={
 game:Game;side:Side;socket:Socket;messages:ChatMessage[];chatEnabled:boolean;onChatSend:(text:string)=>void;
 onClose:()=>void;onMinimize:()=>void;onReplay:(kind:Kind)=>void;questionPending:boolean;
 onAsk:(category:string)=>void;onAnswer:(id:number,yes:boolean)=>void;
 onGuess:(word:string)=>void;onSkip:()=>void;onHeardCorrect:()=>void;onGesture:(yes:boolean)=>void;onChatAnswer:(questionId:string,yes:boolean)=>void;
};
type FloatingMessage={id:string;from:Side;kind:"chat"|"hint"|"guess";text:string;at:number};
const other=(side:Side):Side=>side===0?1:0;
export default function ForeheadView({game,side,socket,messages,chatEnabled,onChatSend,onClose,onMinimize,onReplay,questionPending,onAsk,onAnswer,onGuess,onSkip,onChatAnswer,onHeardCorrect,onGesture}:Props){
 const state=game.forehead;
 const [text,setText]=useState("");
 const [chatDraft,setChatDraft]=useState("");
 const [sceneReady,setSceneReady]=useState(false);
 useEffect(()=>{
  if(!sceneReady||game.phase!=="loading"||game.sceneReady?.[side])return;
  socket.emit("forehead:scene-ready",{id:game.id});
 },[sceneReady,game.id,game.phase,game.sceneReady?.[side],side,socket]);
 const [notice,setNotice]=useState("");
 const [clocks,setClocks]=useState<[number,number]>(()=>[...(game.forehead?.timesLeft??[0,0])] as [number,number]);
 const [remoteLook,setRemoteLook]=useState({yaw:0,pitch:0});
 useEffect(()=>{
   setRemoteLook({yaw:0,pitch:0});
   const onLook=(pose:{id?:string;round?:number;serial?:number;yaw?:number;pitch?:number})=>{
    if(pose.id!==game.id||pose.round!==state?.completed||pose.serial!==state?.wordSerial)return;
    if(typeof pose.yaw==="number"&&typeof pose.pitch==="number")setRemoteLook({yaw:pose.yaw,pitch:pose.pitch});
   };
   socket.on("forehead:look",onLook);
   return()=>{socket.off("forehead:look",onLook);};
 },[socket,game.id,state?.completed,state?.wordSerial]);
 useEffect(()=>{
  if(!state)return;
  const arrived=Date.now();
  const base:[number,number]=[...state.timesLeft];
  const active=state.turn,running=game.phase==="playing";
  const update=()=>{const left:[number,number]=[...base];
   if(running)left[active]=Math.max(0,base[active]-(Date.now()-arrived));
   setClocks(left);
  };
  update();const handle=window.setInterval(update,125);
  return()=>window.clearInterval(handle);
 },[state?.serverNow,state?.turn,game.phase]);
 const [passConfirm,setPassConfirm]=useState(false);
 const [categoryPicker,setCategoryPicker]=useState(false);
 const [floating,setFloating]=useState<FloatingMessage[]>([]);
 const seen=useRef(new Set<string>());
 const openedAt=useRef(Date.now());
 useEffect(()=>{
  const incoming:FloatingMessage[]=[];
  const push=(entry:FloatingMessage)=>{
   if(seen.current.has(entry.id))return;
   seen.current.add(entry.id);incoming.push(entry);
  };
  for(const m of messages.slice(-16)){
   if(m.kind!=="text"||!m.text||m.failed||m.at<openedAt.current-500)continue;
   push({id:"chat:"+m.id,from:m.from,kind:"chat",text:m.text,at:Date.now()});
  }
  const turn=game.forehead;
  if(turn){
   turn.hints.forEach((hint,index)=>push({
    id:`hint:${game.id}:${turn.wordSerial}:${index}`,
    from:other(turn.turn),kind:"hint",text:hint,at:Date.now()
   }));
   turn.guesses.forEach((guess,index)=>push({
    id:`guess:${game.id}:${turn.wordSerial}:${index}`,
    from:turn.turn,kind:"guess",text:guess.text,at:Date.now()
   }));
  }
  if(incoming.length)setFloating(prev=>[...prev,...incoming].slice(-10));
 },[messages,game.forehead,game.id]);
 useEffect(()=>{
  if(!floating.length)return;
  const next=Math.min(...floating.map(m=>m.at+8800-Date.now()));
  const timer=window.setTimeout(()=>setFloating(prev=>prev.filter(m=>Date.now()-m.at<8800)),Math.max(60,next+20));
  return()=>clearTimeout(timer);
 },[floating]);
 useEffect(()=>{setText("");setChatDraft("");setNotice("");setCategoryPicker(false);setPassConfirm(false);},[state?.turn,state?.completed,state?.wordSerial]);
 // Stable server expression IDs drive non-layout SVG feedback.
 const lastExpressionId=useRef(state?.expression?.id??null);
 const [feedback,setFeedback]=useState<{id:number;kind:"correct"|"pass"}|null>(null);
 useEffect(()=>{
  const expression=state?.expression;
  if(!expression||expression.id===lastExpressionId.current)return;
  lastExpressionId.current=expression.id;
  if(expression.kind==="correct"||expression.kind==="pass")
   setFeedback({id:expression.id,kind:expression.kind});
 },[state?.expression?.id,state?.expression?.kind]);
 useEffect(()=>{
  if(!feedback)return;
  const timer=window.setTimeout(()=>setFeedback(old=>old?.id===feedback.id?null:old),1120);
  return()=>window.clearTimeout(timer);
 },[feedback]);
 if(!state)return null;
 const myTurn=state.turn===side;
 const finished=game.phase==="finished";
 const formatClock=(ms:number)=>{
  const seconds=Math.ceil(ms/1000);
  return [Math.floor(seconds/60),seconds%60].map(v=>String(v).padStart(2,"0")).join(":");
 };
 const nearingEnd=clocks[state.turn]<=30000&&!finished;
 const pending=state.pending;
 const chatQuestion=state.chatQuestion?.wordSerial===state.wordSerial?state.chatQuestion:null;
 const awaitingChatReply=!chatQuestion?.answered&&Boolean(chatQuestion);
 const hasQuestion=!!pending;
 const role=finished?"FINISHED":myTurn?"YOU GUESS":"GIVE HINTS";
 const myScore=state.scores[side];
 const theirScore=state.scores[other(side)];
 // First-person view renders the OTHER player. Only animate them when THEY answered.
 // The answerer sees the guesser sitting still; the guesser sees the answerer nod/shake.
 const reaction=myTurn?state.lastAnswer:null;
 return <section className="forehead-overlay" role="dialog" aria-modal="true" aria-label="Pinoy Henyo 3D game">
  <div className="forehead-shell">
   {(game.phase==="loading"||!sceneReady)&&<div className="henyo-asset-loading" role="status" aria-live="polite">
    <div className="henyo-asset-loader"><span className="henyo-asset-loading-ring"/><Gamepad2 size={29} strokeWidth={1.9}/></div>
    <strong>{sceneReady?"Waiting for your partner?":"Preparing Pinoy Henyo?"}</strong>
    <p>{sceneReady?"Your studio is ready. The game starts when both players have loaded.":"Loading 3D characters, stage and lighting"}</p>
    <div className="henyo-loading-steps"><span className={sceneReady?"done":""}>Studio</span><span className={sceneReady?"done":""}>Characters</span><span className={game.phase==="playing"?"done":""}>Both players</span></div>
    <button type="button" className="henyo-loading-exit" onClick={onClose}>Cancel game</button>
   </div>}
   <header className="forehead-header">
    <button className="forehead-back" type="button" onClick={onMinimize} aria-label="Back to chat"><ArrowLeft size={19}/></button>
    <div className="forehead-heading"><strong>Pinoy Henyo <Sparkles size={16}/></strong><span>3D TWO-PLAYER GUESSING GAME</span></div>
    <button type="button" className="forehead-close" onClick={onClose} aria-label="End game"><X size={18}/></button>
   </header>
   <div className="forehead-scoreline">
    <span className={"forehead-score"+(myTurn&&!finished?" is-active":"")}><small>YOU</small><b>{myScore}</b></span>
    <div className="forehead-round"><span>{finished?"FINISHED":`TURN ${state.completed+1}`}</span><strong>{role}</strong></div>
    <span className={"forehead-score"+(!myTurn&&!finished?" is-active":"")}><small>PARTNER</small><b>{theirScore}</b></span>
   </div>
   <div className="forehead-stage">
    <ForeheadScene word={state.otherWord} side={side} active={!finished&&game.phase==="playing"} onReady={()=>setSceneReady(true)}
     onGesture={!myTurn&&!finished&&game.phase==="playing"?onGesture:undefined} isGuesser={myTurn&&!finished}
     remoteLook={remoteLook} expression={state.expression}
     onLocalLook={chatEnabled&&!finished?look=>socket.emit("forehead:look",{id:game.id,round:state.completed,serial:state.wordSerial,...look}):undefined}
     reaction={reaction?{key:reaction.id,yes:reaction.yes}:null} povReaction={!myTurn&&state.lastAnswer?{key:state.lastAnswer.id,yes:state.lastAnswer.yes}:null}/>
    <div className="henyo-dual-clocks" aria-label="Individual player timers">
     {([side,other(side)] as Side[]).map(player=>{
      const remaining=clocks[player],running=!finished&&state.turn===player;
      return <div key={player} className={"henyo-player-timer"+(running?" running":" paused")+(running&&nearingEnd?" urgent":"")} role="timer"
       aria-label={(player===side?"Your":"Partner")+" remaining time"}>
       <small>{player===side?"YOU":"PARTNER"} <span>{running?"LIVE":"PAUSED"}</span></small>
       <strong>{formatClock(remaining)}</strong>
       <div className="henyo-clock-meter"><i style={{width:String(Math.round(remaining/(state.options.durationSeconds*1000)*100))+"%"}}/></div>
      </div>;
     })}
    </div>
    {finished&&<div className="henyo-result-banner" role="status" aria-live="assertive">
     <Trophy size={27}/>
     <strong>{game.winner==="draw"?"It's a draw!":game.winner===side?"You win!":"Partner wins!"}</strong>
     <span>Final score: YOU {myScore} vs PARTNER {theirScore}</span>
     <small>{game.winner==="draw"?"Equal points - great game!":game.winner===side?"You guessed the most words!":"Your partner guessed the most words!"}</small>
    </div>}
    {feedback&&!finished&&<div key={feedback.id} className={"henyo-success-overlay "+feedback.kind} role="status" aria-live="assertive">
     <div className="henyo-success-toast">
      <span className="henyo-success-icon">{feedback.kind==="correct"?<Check size={37} strokeWidth={3.2}/>:<SkipForward size={30} strokeWidth={2.6}/>}</span>
      <strong>{feedback.kind==="correct"?"Correct!":"Turn passed"}</strong>
      {feedback.kind==="correct"&&<small>+1 point</small>}
     </div>
    </div>}
    <div className="forehead-float-layer" aria-live="polite" aria-relevant="additions">
     {([side,other(side)] as Side[]).map(player=><div key={player} className={"forehead-float-column "+(player===side?"mine":"theirs")}>
      {floating.filter(m=>m.from===player).slice(-2).map(entry=><div key={entry.id} className={"forehead-float-bubble "+entry.kind}>
       <span>{player===side?"YOU":"PARTNER"}</span>
       <p>{entry.text.length>85?entry.text.slice(0,85)+"...":entry.text}</p>
      </div>)}
     </div>)}
    </div>
   </div>
   <div className={"forehead-bottom"+(!myTurn&&!finished?" giver-controls":"")}>
    {!finished&&myTurn&&<>
     {passConfirm?
      <div className="henyo-pass-confirm" role="group" aria-label="Confirm passing your turn">
       <span>Pass to your partner?</span>
       <button type="button" onClick={()=>setPassConfirm(false)}>Keep guessing</button>
       <button type="button" className="confirm" onClick={()=>{setPassConfirm(false);onSkip();}}>Pass now</button>
      </div>
      :<div className="henyo-safe-pass"><button type="button" className="forehead-skip" onClick={()=>setPassConfirm(true)}>
       <SkipForward size={15}/> Pass turn
      </button></div>}
     <div className="henyo-spoken-instruction"><Mic size={18}/>
      <span>Speak your questions and guesses through the microphone.</span>
     </div>
    </>}
    {!finished&&!myTurn&&<div className="henyo-voice-correct">
     <p><Mic size={16}/> Your mic is muted. Move your head to answer.</p>
     <button type="button" className="henyo-correct-button" disabled={game.phase!=="playing"} onClick={onHeardCorrect}>
      <Check size={21} strokeWidth={3}/> Correct! +1 point
     </button>
     <small>Tap Correct only when you hear the exact forehead word.</small>
    </div>}
    {finished&&<div className="henyo-finished-actions">
     <button type="button" className="forehead-rematch" onClick={questionPending?onMinimize:()=>onReplay("forehead")}><Gamepad2 size={17}/> {questionPending?game.winner===side?"Ask in chat":"Answer in chat":"Rematch"} <ArrowRight size={16}/></button>
     <button type="button" className="forehead-result-close" onClick={onClose}><X size={16}/> Close</button>
    </div>}
    {notice&&<p className="henyo-local-notice" role="status">{notice}</p>}
   </div>
  </div>
 </section>;
}
