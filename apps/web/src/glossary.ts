import { glossary } from "./glossary-data";

export type GlossaryEntry = (typeof glossary)[number];
export interface TermSegment { text:string; term?:GlossaryEntry }
// Longest aliases win so that “스트레스 DSR” is not split into a plain prefix + DSR.
export function splitTerms(text:string):TermSegment[] {
  const aliases=glossary.flatMap(term=>[...new Set([term.label,...term.aliases])].filter(Boolean).map(alias=>({alias,term})))
    .sort((a,b)=>b.alias.length-a.alias.length);
  const segments:TermSegment[]=[];
  let plain="",index=0;
  const seen=new Set<string>();
  while(index<text.length) {
    const match=aliases.find(({alias})=>text.slice(index,index+alias.length).toLowerCase()===alias.toLowerCase() &&
      (!/^[a-z]/i.test(alias)||!/[a-z0-9_]/i.test(text[index-1]??"")) &&
      (!/[a-z]$/i.test(alias)||!/[a-z0-9_]/i.test(text[index+alias.length]??"")));
    if(!match) {plain+=text[index++];continue;}
    if(plain) {segments.push({text:plain});plain="";}
    segments.push({text:text.slice(index,index+match.alias.length),term:seen.has(match.term.id)?undefined:match.term});
    seen.add(match.term.id);index+=match.alias.length;
  }
  if(plain)segments.push({text:plain});
  return segments;
}
export function termsIn(text:string):GlossaryEntry[] {return splitTerms(text).flatMap(part=>part.term?[part.term]:[]);}
