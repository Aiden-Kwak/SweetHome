import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { glossary } from "./glossary-data";
import { splitTerms, termsIn } from "./glossary";
import type { GlossaryEntry } from "./glossary";
import "./glossary.css";

function TermInfo({term}:{term:GlossaryEntry}) {
  const id=useId();
  const button=useRef<HTMLButtonElement>(null);
  const tip=useRef<HTMLSpanElement>(null);
  const timer=useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open,setOpen]=useState(false);
  const [position,setPosition]=useState({left:12,top:12});
  function cancelClose() {if(timer.current)clearTimeout(timer.current);}
  function close() {cancelClose();setOpen(false);}
  function scheduleClose() {cancelClose();timer.current=setTimeout(()=>setOpen(false),160);}
  function show() {cancelClose();setOpen(true);}
  useEffect(()=>()=>cancelClose(),[]);
  useEffect(()=>{
    if(!open)return;
    function place() {
      const anchor=button.current?.getBoundingClientRect(),box=tip.current?.getBoundingClientRect();
      if(!anchor||!box)return;
      setPosition({left:Math.max(12,Math.min(anchor.left-12,window.innerWidth-box.width-12)),
        top:Math.max(12,anchor.bottom+box.height+12<window.innerHeight?anchor.bottom+8:anchor.top-box.height-8)});
    }
    function key(e:KeyboardEvent){if(e.key==="Escape"){e.stopPropagation();close();}}
    function outside(e:PointerEvent){if(!button.current?.contains(e.target as Node)&&!tip.current?.contains(e.target as Node))close();}
    place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
    document.addEventListener("keydown",key,true);document.addEventListener("pointerdown",outside);
    return()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);document.removeEventListener("keydown",key,true);document.removeEventListener("pointerdown",outside);};
  },[open]);
  return <span className="term-info" onPointerEnter={e=>{if(e.pointerType!=="touch")show();}} onPointerLeave={e=>{if(e.pointerType!=="touch")scheduleClose();}}>
    <button ref={button} type="button" className="term-info-button" aria-label={`${term.label} 용어 설명`} aria-describedby={open?id:undefined} aria-expanded={open}
      onFocus={show} onBlur={close} onClick={e=>{e.preventDefault();e.stopPropagation();show();}}><span aria-hidden="true">i</span></button>
    {open&&createPortal(<span ref={tip} id={id} role="tooltip" className="term-tooltip" style={position} onPointerEnter={cancelClose} onPointerLeave={scheduleClose}>
      <strong>{term.label}</strong><span className="term-definition">{term.description}</span><small>출처: {term.sourceTitle}</small><small className="term-dismiss">Esc 또는 바깥 영역을 누르면 닫힙니다.</small>
    </span>,document.body)}
  </span>;
}
export function GlossaryText({text}:{text:string|null|undefined}) {
  return <>{splitTerms(text??"").map((part,index)=>part.term?<span key={index} className="term-pair">{part.text}<TermInfo term={part.term}/></span>:<span key={index}>{part.text}</span>)}</>;
}
export function TermHints({text}:{text:string}) {
  return <span className="term-hints">{termsIn(text).map(term=><TermInfo term={term} key={term.id}/>)}</span>;
}
export function GlossaryDialog() {
  const dialog=useRef<HTMLDialogElement>(null);
  const [query,setQuery]=useState("");
  const visible=glossary.filter(term=>`${term.label} ${term.aliases.join(" ")} ${term.description}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <button className="glossary-open" onClick={()=>{setQuery("");dialog.current?.showModal();}}>용어 사전</button>
    <dialog ref={dialog} className="glossary-dialog" aria-labelledby="glossary-title" onClick={e=>{if(e.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.current.close();}}}>
      <div className="section-heading"><div><p className="eyebrow">어려운 용어를 쉬운 말로</p><h2 id="glossary-title">정책과 금융 용어 사전</h2></div><button type="button" aria-label="용어 사전 닫기" onClick={()=>dialog.current?.close()}>닫기</button></div>
      <p className="section-description">개념을 이해하기 위한 설명입니다. 실제 적용 비율과 대상은 정책 시행일, 금융기관과 상품에 따라 달라질 수 있습니다.</p>
      <input autoFocus type="search" aria-label="용어 검색" placeholder="LTV, DSR, DTI, 가산금리 검색" value={query} onChange={e=>setQuery(e.target.value)}/>
      <p className="glossary-count" role="status">{visible.length}개 용어</p>
      <dl>{visible.map(term=><div key={term.id}><dt>{term.label}</dt><dd><p>{term.description}</p><a href={term.sourceUrl} target="_blank" rel="noreferrer">{term.sourceTitle} 원문 보기</a></dd></div>)}</dl>
      {!visible.length&&<p className="empty-state">검색한 용어가 없습니다. 다른 이름이나 약어로 검색해 주세요.</p>}
    </dialog>
  </>;
}
