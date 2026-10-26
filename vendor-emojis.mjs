import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const pkg=join(root,"node_modules","emoji-datasource-twitter");
const all=JSON.parse(readFileSync(join(pkg,"emoji.json"),"utf8"));
const source=join(pkg,"img","twitter","64");
const output=join(root,"public","emoji","twemoji");
mkdirSync(output,{recursive:true});

const groups={
  "Smileys & Emotion":98,
  "People & Body":26,
  "Animals & Nature":25,
  "Food & Drink":24,
  "Activities":22,
  "Travel & Places":19,
  "Objects":17,
  "Symbols":19
};
const essentials=[
"grinning","smiley","smile","grin","laughing","sweat_smile","rofl","joy","slightly_smiling_face",
"wink","blush","innocent","smiling_face_with_3_hearts","heart_eyes","kissing_heart","yum","stuck_out_tongue_winking_eye",
"thinking_face","face_with_raised_eyebrow","neutral_face","expressionless","unamused","rolling_on_the_floor_laughing",
"relieved","pensive","sleeping","disappointed","cry","sob","scream","flushed","pleading_face","sunglasses","nerd_face",
"partying_face","star_struck","smiling_face_with_tear","smiling_face_with_hearts","face_with_tears_of_joy",
"wave","raised_hands","clap","thumbsup","thumbsdown","ok_hand","muscle","pray","point_right","point_left",
"heart","orange_heart","yellow_heart","green_heart","blue_heart","purple_heart","black_heart","white_heart",
"sparkles","star","fire","100","eyes","two_hearts","gift_heart","broken_heart","heartpulse","revolving_hearts",
"dog","cat","panda_face","fox_face","frog","butterfly","sunflower","rose","tulip","cherry_blossom",
"pizza","hamburger","fries","cake","birthday","coffee","bubble_tea","tropical_drink",
"video_game","game_die","dart","trophy","soccer","basketball","headphones","musical_note",
"rocket","airplane","car","sunny","rainbow","crescent_moon","cloud","zap"
];
const picked=[];
const seen=new Set();
function add(item){
 if(!item||!item.has_img_twitter||seen.has(item.unified))return false;
 if(!existsSync(join(source,item.image)))return false;
 const cat=item.category;
 if(!(cat in groups))return false;
 seen.add(item.unified);
 picked.push({emoji:String.fromCodePoint(...item.unified.split("-").map(x=>parseInt(x,16))),
  name:item.short_name.replace(/_/g," "),keywords:[...(item.short_names||[]).map(x=>x.replace(/_/g," ")),item.name.toLowerCase()],
  category:cat,file:item.image});
 return true;
}
for(const name of essentials){const item=all.find(x=>x.short_name===name||(x.short_names||[]).includes(name));add(item);}
for(const [category,limit] of Object.entries(groups)){
 let count=picked.filter(x=>x.category===category).length;
 for(const item of all.filter(x=>x.category===category).sort((a,b)=>a.sort_order-b.sort_order)){
  if(count>=limit)break;
  if(add(item))count++;
 }
}
for(const item of picked)copyFileSync(join(source,item.file),join(output,item.file));
mkdirSync(join(root,"src","data"),{recursive:true});
writeFileSync(join(root,"src","data","emojis.json"),JSON.stringify(picked));
writeFileSync(join(root,"public","emoji","CREDITS.txt"),
  "Twemoji artwork © Twitter, Inc. and other contributors\n"+
  "Source: https://github.com/twitter/twemoji\n"+
  "Graphics licensed under Creative Commons Attribution 4.0 International (CC BY 4.0): https://creativecommons.org/licenses/by/4.0/\n"+
  "This directory contains a curated subset of PNG emoji images distributed with emoji-datasource-twitter.\n"+
  "App-specific selection and asset path arrangement by Chat2Play.\n");
console.log("VENDORED_EMOJIS",picked.length,"to",output);
