import {lazy,Suspense} from "react";
const PongScene3D=lazy(()=>import("./PongScene3D"));
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, Crown, Gamepad2, Gem, Heart, Layers3, Moon, Sparkles, Star, Sun, Trophy, X, Zap } from "lucide-react";
import type { Game, Kind, Side } from "./Pieces";
import "./arcade.css";

type MemorySymbol = "sun" | "moon" | "heart" | "star" | "gem" | "zap";
type ArcadeProps = {
 game: Game; side: Side; onFlip:(index:number)=>void;
 onPaddle:(value:{y:number;depth:number})=>void;
 onDrag:(active:boolean)=>void;onSceneReady:()=>void;
 onMinimize:()=>void; onClose:()=>void; onReplay:(kind:Kind)=>void;
};
const icons = { sun:Sun, moon:Moon, heart:Heart, star:Star, gem:Gem, zap:Zap };
const names = { sun:"Sun", moon:"Moon", heart:"Heart", star:"Star", gem:"Diamond", zap:"Lightning" };
function ResultBanner({game,side,onReplay}:{game:Game;side:Side;onReplay:(kind:Kind)=>void}){
 if(game.phase!=="finished")return null;
 const result=game.winner==="draw"?"It's a draw!":game.winner===side?"You won!":"Nice game!";
 return <motion.div className="arcade-result" initial={{opacity:0,scale:.94}} animate={{opacity:1,scale:1}}>
  <span className="arcade-trophy"><Trophy size={24}/></span>
  <h3>{result}</h3>
  <p>{game.winner==="draw"?"An equally matched duo.":game.winner===side?"Great moves — well played.":"Your partner took this round. Ready for a rematch?"}</p>
  <button type="button" className="primary-button" onClick={()=>onReplay(game.kind)}><Gamepad2 size={17}/> Request rematch <ArrowRight size={17}/></button>
 </motion.div>;
}
function MemoryDuel({game,side,onFlip}:{game:Game;side:Side;onFlip:(index:number)=>void}){
 const mem=game.memory;
 if(!mem)return null;
 const myTurn=mem.turn===side;
 const isPlaying=game.phase==="playing";
 return <section className="memory-duel" aria-label="Memory Duel game">
  <div className="duel-scoreboard">
   <div className={"score-player"+(myTurn&&isPlaying?" active":"")}><span className="score-sub">YOU</span><strong>{mem.scores[side]}</strong><span className="score-title">{myTurn&&isPlaying?"Your turn":"Player "+(side+1)}</span></div>
   <div className="duel-score-divider"><Layers3 size={22}/><small>6 PAIRS</small></div>
   <div className={"score-player"+(!myTurn&&isPlaying?" active":"")}><span className="score-sub">STRANGER</span><strong>{mem.scores[side===0?1:0]}</strong><span className="score-title">{!myTurn&&isPlaying?"Their turn":"Player "+(side===0?2:1)}</span></div>
  </div>
  <p className={"duel-turn-note"+(myTurn?" your-turn":"")} aria-live="polite">
   {game.phase==="finished"?"All pairs discovered":mem.resolving?"Not a match — cards turning back":myTurn?"Your move! Find a matching pair.":"Your partner is choosing cards…"}
  </p>
  <div className="memory-grid" role="group" aria-label="Shared memory cards">
   {mem.cards.map((symbol,i)=>{
    const revealed=symbol!==null;
    const matched=mem.matched[i];
    const Symbol=symbol?icons[symbol as MemorySymbol]:Sparkles;
    return <button type="button" key={i} aria-label={revealed?(names[symbol as MemorySymbol]+(matched?" matched":" revealed")):"Hidden card "+(i+1)}
      className={"memory-card"+(revealed?" flipped":"")+(matched?" matched":"")}
      disabled={!isPlaying||!myTurn||mem.resolving||revealed}
      onClick={()=>onFlip(i)}>
       <span className="memory-card-inner"><span className="memory-face memory-back"><span className="memory-back-mark"><Sparkles size={24}/></span></span>
         <span className={"memory-face memory-front symbol-"+symbol}><Symbol size={30} strokeWidth={2.25}/>{matched&&<CheckCircle2 className="match-check" size={16}/>}</span>
       </span>
    </button>;
   })}
  </div>
  <div className="memory-tip"><CircleHelp size={16}/><span>Find two identical icons. Matches earn a point and another turn.</span></div>
 </section>;
}
type PongSnapshot = NonNullable<Game["pong"]>;
// Server physics remains left/right in its canonical coordinates. Each client
// rotates its OWN view so its paddle is at the bottom. This is a perspective
// transformation only: both devices display the exact same authoritative ball.
export function projectPongForSide(x:number,y:number,side:Side){
 return side===0?{x:y,y:1-x}:{x:1-y,y:x};
}
export function paddleFromScreenX(x:number,side:Side){
 return Math.max(0,Math.min(1,side===0?x:1-x));
}
function PongArena({game,side,onPaddle,onDrag,onSceneReady,onReplay}:{game:Game;side:Side;
 onPaddle:(value:{y:number;depth:number})=>void;onDrag:(active:boolean)=>void;onSceneReady:()=>void;onReplay:(kind:Kind)=>void}){
 const state=game.pong;
 if(!state)return null;
 const opponent=side===0?1:0;
 return <section className="pong-game" aria-label="2 player Ping Pong">
  <div className="pong-court">
   <Suspense fallback={<div className="pong-load-screen" role="status">Loading 3D physics engine?</div>}>
    <PongScene3D snapshot={state} side={side} onPaddle={onPaddle}
     onDrag={onDrag} onReady={onSceneReady} active={game.phase==="playing"}/>
   </Suspense>
   <div className="pong-floating-scores" aria-label="Scores, first to five">
    <div className="pong-floating-score opponent"><span>STRANGER</span><strong>{state.scores[opponent]}</strong></div>
    <span className="pong-first-to">FIRST TO 5</span>
    <div className="pong-floating-score self"><span>YOU</span><strong>{state.scores[side]}</strong></div>
   </div>
   {game.phase==="loading"&&<div className="pong-load-screen" role="status">
     <div className="spinner"/> Loading 3D assets
     <small>{game.sceneReady?.[side]?"Your scene is ready. Waiting for your partner?":"Preparing physics and graphics?"}</small>
     <small>Player 1 {game.sceneReady?.[0]?"?":"?"} ? Player 2 {game.sceneReady?.[1]?"?":"?"}</small>
   </div>}
   {state.serving&&game.phase==="playing"&&<span className="pong-serve-note">Next serve</span>}
   <div className="pong-swipe-hud" aria-label="Swipe strength">
    <span>DRAG INTO THE BALL</span><div className="pong-swipe-track"><i/></div>
    <small>Faster, longer swipes hit harder</small>
   </div>
   {game.phase==="finished"&&<div className="pong-result-float"><ResultBanner game={game} side={side} onReplay={onReplay}/></div>}
  </div>
  <div className="pong-controls"><span className="pong-my-paddle"><span className="paddle-key bottom"/> Your paddle starts behind the table</span><span>Drag in any direction to strike</span></div>
 </section>;
}
export function ArcadeView({game,side,onFlip,onPaddle,onDrag,onSceneReady,onMinimize,onClose,onReplay}:ArcadeProps){
 const name=game.kind==="memory"?"Memory Duel":"Ping Pong";
 return <motion.div className="arcade-overlay" role="dialog" aria-label={name} aria-modal="true" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.2}}>
  <motion.div className={"arcade-window"+(game.kind==="pong"?" pong-window":"")} initial={{scale:.96,y:16}} animate={{scale:1,y:0}} exit={{scale:.97,y:10}} transition={{type:"spring",stiffness:330,damping:29}}>
   <header className="arcade-header"><button type="button" onClick={onMinimize} className="arcade-back" aria-label="Back to chat"><ArrowLeft size={19}/> <span>Back to chat</span></button>
    <div className="arcade-heading"><span className="arcade-heading-mark">{game.kind==="memory"?<Layers3 size={20}/>:<Gamepad2 size={20}/>}</span><div><strong>{name}</strong><small>2 player · Live match</small></div></div>
    <button type="button" className="arcade-leave" aria-label="End game" onClick={onClose}><X size={17}/><span>End game</span></button>
   </header>
   <div className={"arcade-content"+(game.kind==="pong"?" pong-content":"")}>
    {game.kind==="memory"&&<div className="arcade-intro"><span className="arcade-live"><i/> MATCH IN PROGRESS</span><h2>Find the perfect pair.</h2><p>Remember the cards. Outmatch your new friend.</p></div>}
    {game.kind==="pong"?<PongArena game={game} side={side} onPaddle={onPaddle} onDrag={onDrag} onSceneReady={onSceneReady} onReplay={onReplay}/>:game.phase==="finished"?<ResultBanner game={game} side={side} onReplay={onReplay}/>:<MemoryDuel game={game} side={side} onFlip={onFlip}/>}
   </div>
   <footer className="arcade-footer"><span><Heart size={15}/> Play nice, have fun.</span><button type="button" onClick={onMinimize}>Minimize and chat <ArrowRight size={16}/></button></footer>
  </motion.div>
 </motion.div>;
}
