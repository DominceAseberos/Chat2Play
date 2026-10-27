import {useEffect,useState} from "react";
import {Crown,Send,SkipForward} from "lucide-react";
import type {Side,WinnerQuestionState} from "./Pieces";
import "./winner-question.css";

type Action="ask"|"answer"|"skip";
type Props={state:WinnerQuestionState;side:Side;connected:boolean;
 onAction:(action:Action,text:string)=>Promise<string|undefined>};

export default function WinnerQuestionCard({state,side,connected,onAction}:Props){
 const question=state.question;
 const [askDraft,setAskDraft]=useState("");
 const [answerDraft,setAnswerDraft]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{setAskDraft("");setAnswerDraft("");setError("");setBusy(false);},
  [question?.id,question?.round,question?.phase]);
 if(!question)return null;
 const isWinner=question.asker===side;
 const skips=state.skipsLeft[side];
 const asking=question.phase==="asking";
 async function submit(action:Action,text=""){
  if(busy||!connected)return;
  setBusy(true);setError("");
  const failure=await onAction(action,text.trim());
  if(failure)setError(failure);
  setBusy(false);
 }
 return <section className="winner-question-card" role="region" aria-label="Winner's question">
  <div className="winner-question-head"><span className="winner-question-mark"><Crown size={17}/></span>
   <div><strong>Winner's question</strong><small>Question {question.round} · Your skips: {skips}/3</small></div>
  </div>
  {asking?isWinner?<>
   <p>{question.round>1?"Your partner skipped. Ask a new question.":"You won. Ask your partner one question."}</p>
   <form onSubmit={e=>{e.preventDefault();if(askDraft.trim().length>=3)void submit("ask",askDraft);}}>
    <label htmlFor="winner-question-input">Your question</label>
    <textarea id="winner-question-input" value={askDraft} onChange={e=>setAskDraft(e.target.value)}
     placeholder="What’s something you’ve always wanted to try?" maxLength={160} rows={2} disabled={!connected||busy}/>
    <div className="winner-question-actions"><small>{askDraft.trim().length}/160</small>
     <button type="submit" disabled={!connected||busy||askDraft.trim().length<3}><Send size={15}/> Ask question</button></div>
   </form>
  </>:<p>{skips>0?`The winner is writing a question. You can answer it or use one of your ${skips} skips.`:"The winner is writing a question. You'll need to answer this one to continue."}</p>
  :<>
   <div className="winner-question-prompt"><small>{isWinner?"YOU ASKED":"WINNER ASKED"}</small><strong>{question.text}</strong></div>
   {isWinner?<p>Waiting for your partner to answer or skip. If they skip, you can ask a new question.</p>
   :<form onSubmit={e=>{e.preventDefault();if(answerDraft.trim())void submit("answer",answerDraft);}}>
     <label htmlFor="winner-answer-input">Your answer</label>
     <textarea id="winner-answer-input" value={answerDraft} onChange={e=>setAnswerDraft(e.target.value)}
      placeholder="Type your answer…" maxLength={500} rows={2} disabled={!connected||busy}/>
     <div className="winner-question-actions">
      {skips>0?<button type="button" className="winner-skip" disabled={!connected||busy}
        onClick={()=>void submit("skip")}><SkipForward size={15}/> Skip · {skips} left</button>
       :<small>No skips left</small>}
      <button type="submit" disabled={!connected||busy||!answerDraft.trim()}><Send size={15}/> Send answer</button>
     </div>
    </form>}
  </>}
  {error&&<p className="winner-question-error" role="alert">{error}</p>}
  <small className="winner-question-foot">{isWinner?"The round ends when your partner answers.":"The round ends when you answer."} You can leave or report at any time.</small>
 </section>;
}
