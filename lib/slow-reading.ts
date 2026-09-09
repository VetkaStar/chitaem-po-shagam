// Accept only ordered fragments of the displayed target, never arbitrary transcript substrings.
export function matchFragment(text:string,target:string,start=0){
 if(!/^[а-яё\s]+$/iu.test(text))return null;
 const input=text.toUpperCase().replace(/Ё/g,'Е').replace(/\s/g,''),word=target.toUpperCase().replace(/Ё/g,'Е');
 if(!input)return null;
 let position=start;
 for(let i=0;i<input.length;i++){
  const char=input[i];
  if(word[position]===char){position++;continue}
  if(i>0&&input[i-1]===char&&/[АЕИОУЫЭЮЯ]/.test(char)&&word[position-1]===char)continue;
  return null;
 }
 return position;
}
export class SlowReadingAttempt{
 private position=0;private lastMatch=0;
 reset(){this.position=0;this.lastMatch=0}
 get progress(){return this.position}
 accept(text:string,confidence:number,target:string,now=Date.now()){
  if(this.position&&now-this.lastMatch>20000)this.reset();
  if(!Number.isFinite(confidence)||confidence<.65){this.reset();return {kind:'unclear' as const,progress:0}}
  const whole=matchFragment(text,target,0);
  if(whole===target.length){this.reset();return {kind:'complete' as const,progress:target.length}}
  const continuation=matchFragment(text,target,this.position);
  if(continuation!==null&&continuation>this.position){this.position=continuation;this.lastMatch=now;if(this.position===target.length){this.reset();return {kind:'complete' as const,progress:target.length}}return {kind:'pending' as const,progress:this.position}}
  // A child may start the word again after a pause.
  if(whole!==null&&whole>0){this.position=whole;this.lastMatch=now;return {kind:'pending' as const,progress:whole}}
  this.reset();return {kind:'unrelated' as const,progress:0};
 }
}
