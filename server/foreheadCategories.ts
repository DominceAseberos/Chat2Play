// Shared, server-validated three-step clue map for Pinoy Henyo.
// A YES at each step unlocks its child options; a NO allows other choices.
export const CATEGORY_TREE = {
  "Country":{
    "Asia":["In Southeast Asia","In East Asia","Island nation","Landlocked","Tropical climate"],
    "Europe":["In Western Europe","In Northern Europe","In Eastern Europe","Uses euro","Has mountains"],
    "Africa":["In North Africa","In East Africa","In Southern Africa","Coastal","Landlocked"],
    "Americas":["In North America","In South America","In Central America","Spanish-speaking","Tropical"],
    "Oceania":["Island nation","In the Pacific","English-speaking","Tropical","Near Australia"],
    "Geography":["Landlocked","Island country","Has a long coastline","Has mountains","Has a desert"]
  },
  "Animal": {
    "Land": ["Four legs","Two legs","No legs","Fur","Scales"],
    "Sea": ["Fins","Shell","Tentacles","Big teeth","Lives in deep water"],
    "Air": ["Feathers","Wings","Can fly","Cannot fly","Beak"],
    "Amphibious": ["Lives on land and in water","Webbed feet","Has a tail","Lays eggs"],
    "Insect": ["Six legs","Wings","Can fly","Lives in a colony","Stings"]
  },
  "Food": {
    "Fruit": ["Sweet","Sour","Has seeds","Grows on a tree","Tropical"],
    "Vegetable": ["Leafy","Root vegetable","Green","Can be eaten raw","Often cooked"],
    "Meat or seafood": ["Chicken","Beef","Pork","Fish","Shellfish"],
    "Snack or dessert": ["Chocolate","Crunchy","Cold","Baked","Sweet"],
    "Prepared dish": ["Soup","Grilled","Fried","With rice","With noodles"],
    "Drink": ["Hot","Cold","Fruity","With milk","Carbonated"]
  },
  "Place": {
    "Indoor": ["Home","School","Hospital","Shopping","Workplace"],
    "Outdoor": ["High elevation","Near the sea","In a city","In the countryside","Open space"],
    "Natural": ["Waterfall","Cave","Forest","River","Island"],
    "Building": ["Tall","Historic","Religious","Entertainment","Government"],
    "Location": ["Philippines","Asia","Europe","Americas","Africa"]
  },
  "Thing": {
    "At home": ["In the kitchen","In the bedroom","For cleaning","For decoration","Furniture"],
    "At school": ["Used for writing","Paper","On a desk","For studying","In a classroom"],
    "Worn or carried": ["Clothing","Accessory","Footwear","Bag","Protective"],
    "Toy or game": ["Electronic","Has wheels","Sports-related","Soft","Collectible"],
    "Tool": ["Handheld","Electric","Cuts","Measures","For building"]
  },
  "Person": {
    "Real person": ["Historical","Celebrity","Leader","Athlete","Artist"],
    "Fictional person": ["Superhero","Villain","Cartoon","Movie character","Book character"],
    "Someone you know": ["Family","Friend","Teacher","Student","Neighbor"],
    "Public figure": ["Politician","Scientist","Performer","Sports star","Internet creator"]
  },
  "Plant": {
    "Tree": ["Fruit-bearing","Tall","Tropical","Flowering","Evergreen"],
    "Flower": ["Red","Yellow","White","Fragrant","Grows in a garden"],
    "Crop": ["Vegetable","Grain","Fruit","Root","Grown on a farm"],
    "Grass or herb": ["Medicinal","Edible","Aromatic","Wild","Used for tea"],
    "Other plant": ["Cactus","Vine","Aquatic","Moss","Fern"]
  },
  "Vehicle": {
    "Land": ["Two wheels","Four wheels","Public transport","Carries goods","Off-road"],
    "Water": ["Boat","Ship","Submarine","With a motor","Uses sails"],
    "Air": ["Airplane","Helicopter","With wings","Carries passengers","Unpowered"],
    "Space": ["Rocket","Satellite","Spacecraft","Carries people","Exploration"]
  },
  "Nature": {
    "Weather": ["Rain","Wind","Storm","Snow","Heat"],
    "Landform": ["Mountain","Hill","Valley","Volcano","Desert"],
    "Water feature": ["Sea","River","Lake","Waterfall","Ocean"],
    "Sky or space": ["Sun","Moon","Stars","Planet","Meteor"],
    "Natural event": ["Earthquake","Eruption","Flood","Eclipse","Rainbow"]
  },
  "Technology": {
    "Device": ["Phone","Computer","Camera","Wearable","Household gadget"],
    "Software": ["Mobile app","Website","Game","AI","Security"],
    "Communication": ["Internet","Radio","Satellite","Messaging","Wireless"],
    "Machine": ["Robot","Engine","Manufacturing","Medical","For transport"],
    "Scientific instrument": ["Measures","Magnifies","Looks into space","Used in a lab","Detects"]
  },
  "Sport": {
    "Ball sport": ["Played with hands","Played with feet","Uses a racket","Uses a bat","Team sport"],
    "Water sport": ["Swimming","Surfing","Boat","Underwater","Racing"],
    "Combat sport": ["Boxing","Martial arts","Wrestling","Uses weapons","Contact"],
    "Racing": ["On foot","Cycling","Vehicles","Track","Long distance"],
    "Other sport": ["Gymnastics","Winter sport","Climbing","Dance","Target sport"]
  },
  "Job": {
    "Healthcare": ["Treats patients","Hospital","Emergency","Teeth","Animals"],
    "Education": ["School","College","Coaching","Research","Children"],
    "Technology": ["Programming","Design","Repairs","Cybersecurity","AI"],
    "Service": ["Food","Shopping","Cleaning","Travel","Customer support"],
    "Public service": ["Police","Firefighter","Military","Government","Rescue"],
    "Creative": ["Artist","Music","Writer","Film","Fashion"]
  },
  "Fictional character": {
    "Movie or TV": ["Animated","Live action","Hero","Villain","Sidekick"],
    "Cartoon or anime": ["Animal character","Human character","Has superpowers","School setting","Funny"],
    "Book or comic": ["Fantasy","Superhero","Mystery","Adventure","Classic"],
    "Game character": ["Human","Creature","Hero","Villain","Playable"],
    "Myth or folklore": ["Monster","Deity","Magical","Legend","Folklore"]
  }
} as const;

export const FOREHEAD_CATEGORIES=Object.keys(CATEGORY_TREE);
export type ForeheadCategory=string;
export const MAX_HINT_LEVELS=3;
export function categoryOptions(path:readonly string[]):string[]{
 if(path.length===0)return [...FOREHEAD_CATEGORIES];
 const tree=CATEGORY_TREE as Record<string,Record<string,readonly string[]>>;
 if(path.length===1)return Object.keys(tree[path[0]]??{});
 if(path.length===2)return [...(tree[path[0]]?.[path[1]]??[])];
 return [];
}
