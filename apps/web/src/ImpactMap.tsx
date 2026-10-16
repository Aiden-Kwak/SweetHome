import { useState } from "react";
import { formatMedian, formatRange, getDivergingTone } from "./format";
import type { Boundary, CohortResult, MetricKey, PublicContext, RegionResult, ValueRange } from "./types";

export function metricRange(region: RegionResult, metric: MetricKey): ValueRange | null {
  return metric === "mortgage_limit_change" ? region.mortgage_limit_change ?? null : region[metric];
}

const project = ([lon, lat]: [number, number]) => [(lon - 126.52) * 1000 + 20, (37.74 - lat) * 1260 + 12];
export function boundaryPath(boundary: Boundary): string {
  return boundary.rings.map(ring => ring.map((p, i) => `${i ? "L" : "M"}${project(p).map(v => v.toFixed(1)).join(",")}`).join("") + "Z").join("");
}

export function boundaryLabelPoint(boundary: Boundary): [number, number] {
  const ring = [...boundary.rings].sort((a,b)=>b.length-a.length)[0] ?? [];
  if (!ring.length) return [0,0];
  const projected = ring.map(project);
  return [
    (Math.min(...projected.map(p=>p[0])) + Math.max(...projected.map(p=>p[0]))) / 2,
    (Math.min(...projected.map(p=>p[1])) + Math.max(...projected.map(p=>p[1]))) / 2,
  ];
}

export function boundaryViewBox(boundaries: Boundary[]): string {
  const points = boundaries.flatMap(b=>b.rings.flatMap(r=>r.map(project)));
  if (!points.length) return "0 0 840 560";
  const bounds = points.reduce((b,p)=>[
    Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1]),
  ],[Infinity,Infinity,-Infinity,-Infinity]);
  const [minX,minY,maxX,maxY]=bounds;
  const width=Math.max(500,maxX-minX+40),height=Math.max(410,maxY-minY+40);
  return `${(minX+maxX-width)/2} ${(minY+maxY-height)/2} ${width} ${height}`;
}
// Label anchors are display positions, not property or station coordinates.
const anchors: Record<string, [number, number]> = {
  "11350":[127.07,37.655], "11440":[126.90,37.565], "41450":[127.22,37.515],
  "11200":[127.039,37.56], "11740":[127.155,37.555], "11650":[127.007,37.46],
  "11680":[127.072,37.49], "11710":[127.12,37.505], "41290":[126.995,37.414],
  "41135":[127.12,37.365], "28185":[126.66,37.405],
};
const labels: Record<string, string> = { "11350":"노원", "11440":"마포", "41450":"하남", "11200":"성동", "11740":"강동", "11650":"서초", "11680":"강남", "11710":"송파", "41290":"과천", "41135":"분당", "28185":"연수" };

export function cohortRegions(cohort: CohortResult | null, regions: RegionResult[]) {
  const codes = (names?: string[] | null) => (names ?? []).flatMap(name => {
    const region = regions.find(r => r.region_name === name);
    return region ? [region.region_code] : [];
  });
  return { before: codes(cohort?.selectable_regions_before), after: codes(cohort?.selectable_regions_after) };
}

export function ImpactMap({ context, regions, selected, metric, cohort, onSelect }: {
  context: PublicContext | null; regions: RegionResult[]; selected: string; metric: MetricKey;
  cohort: CohortResult | null; onSelect: (code: string) => void;
}) {
  const [zoom, setZoom] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 540px)").matches);
  const [showRoutes, setShowRoutes] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const threshold = metric === "price_change" ? 1 : 10;
  const regionMap = new Map(regions.map(r => [r.region_code, r]));
  const cohortCodes = cohortRegions(cohort, regions);
  const target = cohortCodes.before.find(code => anchors[code] && !cohortCodes.after.includes(code));
  const substitutes = cohortCodes.after.filter(code => anchors[code] && !cohortCodes.before.includes(code));
  return <div className="map-stage">
    <div className="map-overlay top-left"><span className="map-dot" />수도권 <span className="muted">/ {regions.length}개 시나리오 지역</span></div>
    <div className="map-controls">
      <button onClick={() => setZoom(!zoom)} aria-pressed={zoom}>{zoom ? "수도권 전체" : "서울 확대"}</button>
      <button onClick={() => setShowRoutes(!showRoutes)} aria-pressed={showRoutes}>선택지 변화 {showRoutes ? "켜짐" : "꺼짐"}</button>
    </div>
    {!context ? <div className="map-unavailable">지도 자료를 불러오지 못했습니다. 아래 지역 선택 목록은 계속 사용할 수 있습니다.</div> :
      <svg className="impact-map" viewBox={zoom ? "260 20 500 410" : "0 0 840 560"} aria-label="실제 행정경계 위에 표시한 합성 정책 시나리오 지도">
        <defs><marker id="flow-tip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#7465ac" /></marker></defs>
        <g>{context.boundaries.map(boundary => {
          const region = boundary.region_code ? regionMap.get(boundary.region_code) : null;
          const range = region ? metricRange(region, metric) : null;
          return <path key={boundary.code} d={boundaryPath(boundary)} fillRule="evenodd" data-region-code={boundary.region_code}
            className={`geo-region ${range ? `tone-${getDivergingTone(range, threshold)}` : "no-result"} ${boundary.region_code === selected ? "selected" : ""} ${region?.effect_type === "spillover" ? "spillover" : ""}`}
            {...(region ? { role:"button", tabIndex:0, "aria-label":`${region.region_name} ${range ? formatRange(range) : "자료 없음"}`, "aria-pressed":region.region_code === selected,
              onPointerEnter:() => setHovered(region.region_code), onPointerLeave:() => setHovered(null),
              onFocus:(e: React.FocusEvent<SVGPathElement>) => setFocused(e.currentTarget.matches(":focus-visible") ? region.region_code : null), onBlur:() => setFocused(null),
              onClick:() => onSelect(region.region_code), onKeyDown:(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(region.region_code); } } } : {})} />;
        })}</g>
        {showRoutes && target && substitutes.map(code => {
          const [x1,y1] = project(anchors[target]); const [x2,y2] = project(anchors[code]);
          return <path key={code} d={`M${x1},${y1} Q${(x1+x2)/2-28},${(y1+y2)/2-20} ${x2},${y2}`} className="demand-flow" markerEnd="url(#flow-tip)" />;
        })}
        {/* Paint highlights after every fill so adjacent polygons cannot cover shared edges.
            Reuse the hit-target geometry and never intercept pointer events. */}
        <g className="geo-highlights" pointerEvents="none" aria-hidden="true">
          {([ [hovered, "hovered"], [selected, "selected"], [focused, "focused"] ] as const).map(([code, state]) =>
            code && context.boundaries.filter(boundary => boundary.region_code === code).map(boundary =>
              <path key={`${state}-${boundary.code}`} d={boundaryPath(boundary)}
                data-region-code={code} className={`geo-highlight ${state}`} vectorEffect="non-scaling-stroke" />
            )
          )}
        </g>
        {regions.map(region => {
          const anchor = anchors[region.region_code]; if (!anchor) return null;
          const [x,y] = project(anchor); const range = metricRange(region, metric);
          return <g key={region.region_code} transform={`translate(${x},${y})`} className={`geo-label ${region.region_code === selected ? "active" : ""}`} pointerEvents="none">
            <text textAnchor="middle">{labels[region.region_code]}{region.region_code === selected ? " ●" : ""}</text>
            <text textAnchor="middle" y="16" className="geo-value">{range ? formatMedian(range) : "미확보"}</text>
          </g>;
        })}
        <text x="80" y="295" className="area-label">인천</text><text x="360" y="110" className="area-label">서울</text><text x="670" y="420" className="area-label">경기</text>
      </svg>}
    <div className="map-key"><span><i className="key-down" />하방</span><span><i className="key-neutral" />보합</span><span><i className="key-up" />상방</span><span>보합 ±{threshold * 0.2}% / 진한 색 ±{threshold}% 이상</span><span>회색: 미산출</span><span>점선: 전이 가정</span></div>
    <div className="map-attribution"><a href="https://github.com/southkorea/southkorea-maps/tree/master/kostat/2018/json" target="_blank" rel="noreferrer">통계청 SGIS 2018 경계</a> / 공공누리 제1유형 / 숫자는 합성 중앙값, 연결선은 선택지 변화 예시</div>
  </div>;
}
