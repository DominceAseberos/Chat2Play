import {GAMES,GENDERS,PREFS,type Gender,type Preference,type Kind} from "./Pieces";

const PROFILE_KEY="c2p:matching-profile:v1";
export type SavedMatchingProfile={
 gender:Gender;
 lookingFor:Preference;
 interests:Kind[];
 fallback:"automatic"|"strict";
 completed:true;
};
const validGender=new Set<string>(GENDERS.map(g=>g.value));
const validPreference=new Set<string>(PREFS.map(p=>p.value));
const validGames=new Set<string>(GAMES.map(g=>g.id));
/** Only personal setup choices are stored locally; never messages or match details. */
export function loadMatchingProfile():SavedMatchingProfile|null{
 try{
  const serialized=localStorage.getItem(PROFILE_KEY);
  if(!serialized)return null;
  const p:unknown=JSON.parse(serialized);
  if(!p||typeof p!=="object")return null;
  const profile=p as Partial<SavedMatchingProfile>;
  if(profile.completed!==true
   ||typeof profile.gender!=="string"||!validGender.has(profile.gender)
   ||typeof profile.lookingFor!=="string"||!validPreference.has(profile.lookingFor)
   ||(profile.fallback!=="automatic"&&profile.fallback!=="strict")
   ||!Array.isArray(profile.interests)
   ||profile.interests.length>GAMES.length
   ||!profile.interests.every(x=>typeof x==="string"&&validGames.has(x)))return null;
  return {gender:profile.gender,lookingFor:profile.lookingFor,interests:[...new Set(profile.interests)],fallback:profile.fallback,completed:true};
 }catch{return null;}
}
export function saveMatchingProfile(profile:SavedMatchingProfile):boolean{
 try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));return true;}
 catch{return false;}
}
export function clearMatchingProfile():void{
 try{localStorage.removeItem(PROFILE_KEY);}catch{/* Private browsing/storage disabled. */}
}
