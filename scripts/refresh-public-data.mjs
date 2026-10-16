/** Refresh public, attributed snapshots. No credentials or model outputs are used. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = `${root}data/public`;
await mkdir(`${dir}/raw`, { recursive: true });
const retrieved = new Date().toISOString();
const hash = (s) => createHash('sha256').update(s).digest('hex');
async function download(url, filename) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  const raw = await response.text();
  const json = JSON.parse(raw);
  await writeFile(`${dir}/raw/${filename}`, raw);
  return { json, sha256: hash(raw), url };
}

const boundaryUrl = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-topo-simple.json';
const boundary = await download(boundaryUrl, 'kostat-2018.topo.json');
const topo = boundary.json;
const arcs = topo.arcs.map(arc => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * topo.transform.scale[0] + topo.transform.translate[0],
      y * topo.transform.scale[1] + topo.transform.translate[1]];
  });
});
const codes = { '노원구':'11350', '마포구':'11440', '하남시':'41450', '성동구':'11200',
  '강동구':'11740', '서초구':'11650', '강남구':'11680', '송파구':'11710',
  '과천시':'41290', '성남시분당구':'41135', '연수구':'28185' };
const seoulCodes = JSON.parse(await readFile(`${dir}/seoul-districts.json`, 'utf8')).districts;
const geometries = topo.objects.skorea_municipalities_2018_geo.geometries;
const boundaries = geometries.filter(g => /^(11|23|31)/.test(g.properties.code)).map(g => ({
  code: g.properties.code,
  region_code: (g.properties.code.startsWith('11') ? seoulCodes : codes)[g.properties.name.replaceAll(' ', '')] ?? null,
  name: g.properties.name,
  rings: (g.type === 'MultiPolygon' ? g.arcs.flat() : g.arcs).map(ring => ring.flatMap((index, i) => {
    const points = index < 0 ? [...arcs[~index]].reverse() : arcs[index];
    return (i ? points.slice(1) : points).map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]);
  })),
}));
if (boundaries.filter(b => b.code.startsWith('11') && b.region_code).length !== 25) throw new Error('Seoul district mapping incomplete');

const queries = [], transactions = [];
for (const code of ['11680', '11200', '11440']) {
  for (const date of ['20250626', '20250627']) {
    const params = ['2025', code, ' ', ' ', ' ', ' ', ' ', ' ', ' ', date, '아파트'];
    const url = `http://openapi.seoul.go.kr:8088/sample/json/tbLnOpendataRtmsV/1/5/${params.map(encodeURIComponent).join('/')}/`;
    const result = await download(url, `seoul-${code}-${date}.json`);
    const data = result.json.tbLnOpendataRtmsV;
    if (!data || data.RESULT.CODE !== 'INFO-000') throw new Error(`Seoul API returned no data: ${code} ${date}`);
    queries.push({ region_code: code, contract_date: `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6)}`,
      source_url: url, sha256: result.sha256, total_matching: data.list_total_count, returned: data.row.length });
    for (const row of data.row) {
      if (row.CGG_CD !== code || row.CTRT_DAY !== date || row.BLDG_USG !== '아파트') throw new Error('Unexpected Seoul filters');
      const iso = s => s ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}` : null;
      transactions.push({ id: `seoul_${hash(JSON.stringify(row)).slice(0,16)}`, region_code: code,
        region_name: row.CGG_NM, neighborhood: row.STDG_NM, building_name: row.BLDG_NM,
        contract_date: iso(row.CTRT_DAY), area_m2: Number(row.ARCH_AREA), floor: Number(row.FLR),
        price_krw: Number(row.THING_AMT) * 10000, canceled_at: iso(row.RTRCN_DAY),
        transaction_type: row.DCLR_SE, source_query: queries.length - 1 });
    }
  }
}
const context = {
  schema_version: '1.0.0', status: 'OBSERVED_SAMPLE', retrieved_at: retrieved,
  boundary_source: { title:'통계청 SGIS 2018 시군구 경계', url:boundaryUrl,
    publisher:'통계청 / southkorea-maps', license:'공공누리 제1유형', reference_year:2018, sha256:boundary.sha256 },
  transaction_source: { title:'서울시 부동산 실거래가 정보', url:'https://data.seoul.go.kr/dataList/OA-21275/S/1/datasetView.do',
    publisher:'서울특별시 (국토교통부 실거래가 연계)', license:'공공누리 제1유형' },
  sampling_note:'공식 sample API에서 지역별, 계약일별 첫 5건만 수집했습니다. 무작위 표본이나 전체 거래가 아닙니다.',
  limitations:[
    '2025-06-26~27 계약을 현재 조회한 자료입니다. 이후 정정과 취소가 포함될 수 있어 당시 시점의 데이터로 사용할 수 없습니다.',
    '단지와 면적, 층이 서로 다른 소규모 표본입니다. 지역 평균 시세, 추세, 정책 효과를 계산하지 않습니다.',
    '실거래 관측 자료는 시나리오 계수나 예측값에 반영하지 않았습니다.',
    '2018년 경계는 공간적 맥락을 위한 참고 자료이며 현재의 행정경계나 법적 규제 범위를 보증하지 않습니다.'
  ], boundaries, queries, transactions
};
await writeFile(`${dir}/context.json`, JSON.stringify(context));
console.log(`Saved ${boundaries.length} boundaries, ${transactions.length} observed transactions from ${queries.length} public queries.`);
