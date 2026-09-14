/** Russian spelling identity. Never merge Е/Ё or remove Ь/Ъ for literacy assessment. */
export function normalise(s){if(typeof s!=='string')throw new TypeError('Expected string');return s.normalize('NFC').toLocaleUpperCase('ru-RU').replace(/\s+/gu,' ').trim();}
export function words(s){return normalise(s).match(/[А-ЯЁ]+/gu)??[];}
export function unique(a){return [...new Set(a)];}
export function equalSet(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&a.every(x=>b.includes(x));}
export function stableShuffle(values,seed){let h=2166136261;for(const c of String(seed)){h^=c.codePointAt(0);h=Math.imul(h,16777619)>>>0;}const a=[...values];for(let i=a.length-1;i>0;i--){h=(Math.imul(h,1664525)+1013904223)>>>0;const j=h%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
