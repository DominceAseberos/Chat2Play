import assert from "node:assert/strict";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createServer} from "vite";
const vite=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"error"});
try{
 const {default:ForeheadView}=await vite.ssrLoadModule("/src/ForeheadView.tsx");
 const base={
   kind:"forehead",id:"result-check",phase:"finished",by:0,ready:[true,true],winner:0,
   forehead:{
    otherWord:"",turn:1,completed:5,maxRounds:0,scores:[3,1],
    hints:[],guesses:[],notice:"Time's up!",attemptsLeft:5,pending:null,asked:[],lastAnswer:null,
    options:{difficulty:"easy",durationSeconds:60},timesLeft:[0,0],endsAt:123456,
    serverNow:123456,wordSerial:8,expression:null
   }
 };
 for(const [winner,side,expected] of [[0,0,"You win!"],[0,1,"Partner wins!"],["draw",0,"It's a draw!"]]){
  const game={...base,winner};
  const html=renderToStaticMarkup(React.createElement(ForeheadView,{
   game,side,socket:{on(){},off(){}},messages:[],chatEnabled:true,
   onChatSend(){},onClose(){},onMinimize(){},onReplay(){},onAsk(){},onAnswer(){},onGuess(){},onSkip(){}
  }));
  for(const required of [expected,"Rematch","Close","Final score","henyo-result-banner","henyo-finished-actions"]){
   assert.ok(html.replaceAll("&#x27;","\u0027").includes(required),`Result for ${winner}/${side} missing ${required}`);
  }
  assert.ok(!html.includes("Pass turn"),"No gameplay controls on finished match");
  console.log("PASS final result UI",winner,side,expected);
 }
 console.log("WINNER, REMATCH AND CLOSE UI TESTS PASSED");
}catch(error){console.error(error);process.exitCode=1;}
finally{await vite.close();}
