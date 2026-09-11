import {normalize} from './learning';
export type Verdict={kind:'correct'|'wrong'|'unclear'|'ignore'|'rest';heard?:string};
export function classifyUtterance(text:string,confidence:number,target:string,candidates:string[],aliases:string[]=[]):Verdict{
 const phrase=text.toLocaleLowerCase('ru').replace(/[.,!?;:]/g,' ').replace(/\s+/g,' ').trim();
 if(/(?:^|\s)(?:не хочу|не буду|не надо|хватит|устал|устала|стоп|отдохнуть)(?:\s|$)/u.test(phrase))return {kind:'rest'};
 if(!phrase||phrase.includes('[unk]'))return {kind:'ignore'};
 const clean=normalize(phrase),allowed=[target,...candidates,...aliases];
 if(!allowed.some(w=>normalize(w)===clean))return {kind:'ignore'};
 if(phrase.split(' ').length>1&&!aliases.some(w=>normalize(w)===clean))return {kind:'ignore'};
 if(confidence<.55)return {kind:'unclear'};
 if([target,...aliases].some(w=>normalize(w)===clean))return {kind:'correct'};
 if(confidence<.8)return {kind:'unclear'};
 return {kind:'wrong',heard:allowed.find(w=>normalize(w)===clean)};
}
