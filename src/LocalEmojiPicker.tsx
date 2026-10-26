import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import emojis from "./data/emojis.json";
import "./local-emojis.css";

type Item = {emoji:string;name:string;keywords:string[];category:string;file:string};
const all=emojis as Item[];
const categories=[
  ["Smileys & Emotion","Faces"],["People & Body","People"],["Animals & Nature","Nature"],
  ["Food & Drink","Food"],["Activities","Play"],["Travel & Places","Travel"],
  ["Objects","Objects"],["Symbols","Symbols"]
] as const;

export default function LocalEmojiPicker({onSelect}:{onSelect:(emoji:string)=>void}) {
  const [category,setCategory]=useState<string>("Smileys & Emotion");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(0);
  const visible=useMemo(()=>{
    const term=search.toLowerCase().trim();
    return all.filter(e=>term?(e.name.includes(term)||e.keywords.some(k=>k.includes(term))):e.category===category);
  },[category,search]);
  const mobile=window.matchMedia("(max-width:700px)").matches;
  const pageCount=Math.max(1,Math.ceil(visible.length/24));
  const safePage=Math.min(page,pageCount-1);
  const paged=mobile?visible.slice(safePage*24,(safePage+1)*24):visible;
  return <section className="local-emoji-picker" aria-label="Emoji picker with locally hosted Twemoji artwork">
    <label className="emoji-local-search"><Search size={16}/><input
      aria-label="Search emojis" value={search} maxLength={50} placeholder="Search emoji"
      onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label>
    <div className="emoji-category-tabs" role="group" aria-label="Emoji categories">
      {categories.map(([id,name])=><button key={id} type="button"
        aria-pressed={category===id && !search}
        className={category===id&&!search?"active":""}
        onClick={()=>{setCategory(id);setSearch("");setPage(0);}}>{name}</button>)}
    </div>
    <div className="emoji-local-scroll">
      <div className="emoji-local-grid">
        {paged.map(item=><button key={item.file} type="button" title={item.name}
          aria-label={item.name} onClick={()=>onSelect(item.emoji)}>
          <img src={`/emoji/twemoji/${item.file}`} width="29" height="29"
            loading="lazy" decoding="async" alt=""/>
        </button>)}
      </div>
      {visible.length===0&&<p className="emoji-no-results">No matching emoji. Try another word.</p>}
    </div>
    <nav className="emoji-pages" aria-label="Emoji pages"><button type="button" onClick={()=>setPage(v=>Math.max(0,v-1))} disabled={safePage===0}>Previous</button><span>{safePage+1} / {pageCount}</span><button type="button" onClick={()=>setPage(v=>Math.min(pageCount-1,v+1))} disabled={safePage===pageCount-1}>Next</button></nav>
    <div className="emoji-credits">250 emojis · Assets hosted locally · <a href="https://github.com/twitter/twemoji" target="_blank" rel="noopener noreferrer">Twemoji CC BY 4.0</a></div>
  </section>;
}
