import { useEffect, useRef } from "react";

export interface RegionOption { code: string; name: string }
export function toggleRegionGroup(selected: string[], codes: string[], checked: boolean): string[] {
  return checked ? [...new Set([...selected, ...codes])] : selected.filter(code=>!codes.includes(code));
}
function GroupCheck({label, codes, selected, onChange}: {
  label: string; codes: string[]; selected: string[]; onChange: (codes: string[])=>void;
}) {
  const ref=useRef<HTMLInputElement>(null);
  const count=codes.filter(code=>selected.includes(code)).length;
  useEffect(()=>{if(ref.current)ref.current.indeterminate=count>0&&count<codes.length;},[count,codes.length]);
  return <label className="workflow-check region-group-check"><input ref={ref} type="checkbox"
    checked={codes.length>0&&count===codes.length} disabled={!codes.length}
    onChange={e=>onChange(toggleRegionGroup(selected,codes,e.target.checked))}/>{label}</label>;
}
export function RegionPicker({options, selected, onChange}: {
  options: RegionOption[]; selected: string[]; onChange: (codes: string[])=>void;
}) {
  const groups=["서울","인천","경기"].map(name=>({name,options:options.filter(o=>o.name.startsWith(name+" "))})).filter(g=>g.options.length);
  return <section className="region-picker" aria-label="정책 적용 지역 선택">
    <div className="region-picker-toolbar">
      <GroupCheck label={`전체 선택 (${options.length}개 지역)`} codes={options.map(o=>o.code)} selected={selected} onChange={onChange}/>
      <div className="region-picker-actions">
        <button type="button" onClick={()=>onChange(toggleRegionGroup(selected,options.filter(o=>o.name.startsWith("서울 ")).map(o=>o.code),true))}>서울 25개 구 선택</button>
        <button type="button" onClick={()=>onChange([])} disabled={!selected.length}>모두 해제</button>
      </div>
    </div>
    {groups.map(group=><details className="region-picker-group" key={group.name} open={group.name==="서울"}>
      <summary>{group.name}<span>{group.options.filter(o=>selected.includes(o.code)).length} / {group.options.length}개 선택</span></summary>
      <GroupCheck label={`${group.name} 전체 선택`} codes={group.options.map(o=>o.code)} selected={selected} onChange={onChange}/>
      <div className="workflow-regions">{group.options.map(r=><label key={r.code}><input type="checkbox" checked={selected.includes(r.code)}
        onChange={e=>onChange(toggleRegionGroup(selected,[r.code],e.target.checked))}/>{r.name}</label>)}</div>
    </details>)}
  </section>;
}
