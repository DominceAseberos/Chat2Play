import {Hand,Scissors} from "lucide-react";
import type {Choice} from "./Pieces";

export function RpsSignIcon({choice,size=26}:{choice:Choice;size?:number}){
 if(choice==="paper")return <Hand size={size} aria-hidden="true"/>;
 if(choice==="scissors")return <Scissors size={size} aria-hidden="true"/>;
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
  <path d="M3 17.5 5.4 9 10 4.5l7.2 1.2L21 12l-2.6 7-8.3 1.5L3 17.5Z"/>
  <path d="m5.4 9 5.8 2.4L17.2 5.7M11.2 11.4l-.9 9.1M11.2 11.4 21 12" opacity=".55"/>
 </svg>;
}
