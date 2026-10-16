"""Fixture-backed repository, knowledge graph builder, and multi-horizon simulator."""

from __future__ import annotations

import hashlib
import io
import json
import xml.etree.ElementTree as ET
import zipfile
from calendar import monthrange
from datetime import date
from pathlib import Path
from typing import Any

from policymap_api.models import (
    ActionProbabilities,
    CausalNode,
    Claim,
    DataStatus,
    ExtractionStepStatus,
    GraphEdge,
    GraphNode,
    GraphResponse,
    PolicyExtractRequest,
    PolicyExtractResponse,
    PolicySnapshot,
    RegionResult,
    ScenarioRequest,
    ScenarioResult,
    ValueRange,
)
from policymap_api.public_data import load_public_context

MECHANISM_LABELS: dict[str, str] = {
    "borrowing_capacity": "차입 한도 제약",
    "debt_service_constraint": "원리금 상환부담(DSR) 제약",
    "buyer_demand": "레버리지 매수 수요 둔화",
    "transaction_eligibility": "거래 허가 및 취득 자격 제약",
    "residency_obligation": "2년 실거주 의무 부과",
    "investor_demand": "전세 끼고 매수(갭투자) 수요 차단",
    "spatial_substitution": "인접 비규제 및 중저가 권역 풍선효과",
    "discretionary_consumption_cut": "재량소비 축소 및 유동성 경색",
    "lock_in_and_asset_reallocation": "기존 주택 처분 압박 및 자산 재배치",
    "policy_loan_exemption": "정책모기지 특례 유지 및 중저가 수요 유입",
    "credit_supply_contraction": "가계신용 공급 축소",
    "expectation_channel": "주택가격 기대심리 경로",
}

HORIZON_FACTORS: dict[int, tuple[float, float, str]] = {
    0: (0.35, 0.55, "발표 직후"),
    3: (0.75, 1.15, "3개월 후"),
    6: (1.00, 1.00, "6개월 후"),
    12: (0.85, 0.72, "12개월 후"),
}


def _months_after(start: date, months: int) -> date:
    month = start.month - 1 + months
    year = start.year + month // 12
    month = month % 12 + 1
    return date(year, month, min(start.day, monthrange(year, month)[1]))


def _recalculate_cohorts(result: ScenarioResult, active: set[str],
                         horizon_strength: float) -> None:
    """Reweight the explicit synthetic full-policy example by selected applicable rules."""
    unchanged = {"demo_rule_policy_loan_exception"}
    for cohort in result.cohorts:
        relevant = set(cohort.driving_rule_ids or []) - unchanged
        chosen = relevant & active
        strength = min(1.0, len(chosen) / len(relevant) * horizon_strength) if relevant else 0.0
        finance_rules = relevant & {"demo_rule_mortgage_cap", "demo_rule_stress_dsr_phase3"}
        loan_strength = (
            min(1.0, len(chosen & finance_rules) / len(finance_rules) * horizon_strength)
            if finance_rules else 0.0
        )

        def scaled(before: float, full: float, weight: float = strength) -> float:
            return round(before + (full - before) * weight, 6)

        baseline_power, full_power = cohort.purchasing_power_before, cohort.purchasing_power_after
        if baseline_power and full_power:
            cohort.purchasing_power_after = ValueRange(
                low=scaled(baseline_power.low, full_power.low),
                median=(scaled(baseline_power.median, full_power.median)
                        if baseline_power.median is not None and full_power.median is not None
                        else None),
                high=scaled(baseline_power.high, full_power.high),
                unit=baseline_power.unit,
            )
        if cohort.max_loan_before_krw is not None and cohort.max_loan_after_krw is not None:
            cohort.max_loan_after_krw = round(scaled(
                cohort.max_loan_before_krw, cohort.max_loan_after_krw, loan_strength
            ))
        if cohort.dsr_before_percent is not None and cohort.dsr_after_percent is not None:
            cohort.dsr_after_percent = scaled(
                cohort.dsr_before_percent, cohort.dsr_after_percent,
                horizon_strength if "demo_rule_stress_dsr_phase3" in chosen else 0.0,
            )
        baseline, full = cohort.action_probabilities_before, cohort.action_probabilities_after
        if baseline and full:
            values = {key: scaled(getattr(baseline, key), getattr(full, key))
                      for key in ("buy", "sell", "lease", "gift")}
            values["wait"] = round(1.0 - sum(values.values()), 6)
            cohort.action_probabilities_after = ActionProbabilities(**values)
        cohort.driving_rule_ids = sorted(chosen)
        if strength < 1:
            # Region choices are categorical; partial synthetic weights do not locate a move.
            cohort.selectable_regions_after = cohort.selectable_regions_before
        if strength == 0:
            cohort.selectable_regions_after = cohort.selectable_regions_before
            cohort.response = (
                "선택한 정책 중 이 가구에 적용된 변경 규칙이 없어 기준 상태를 유지합니다."
            )
            cohort.dominant_constraint = "적용된 변경 규칙 없음"
        else:
            cohort.response = (
                f"선택한 변경 규칙 {len(chosen)}개가 이 가구에 적용됩니다. "
                f"6개월 기준 합성 예시 변화량의 {strength * 100:.0f}%를 "
                "선택한 정책과 기간의 민감도로 반영했습니다."
            )
            cohort.dominant_constraint = "적용 규칙: " + ", ".join(sorted(chosen))
        cohort.assumptions = (
            f"{cohort.assumptions or ''} / 적용 변경 규칙 {len(chosen)}개, "
            f"기간 계수 {horizon_strength:.2f}, 합성 민감도 가중치 {strength:.2f}. "
            "규칙별 독립 효과를 측정한 값은 아닙니다."
        )


class FixtureNotFoundError(LookupError):
    """Raised when a request is outside the explicit fixture scope."""


def extract_text_from_hwpx_bytes(raw_bytes: bytes) -> str:
    """Extract plain text from HWPX (OWPML ZIP archive) bytes using standard library."""
    texts: list[str] = []
    with zipfile.ZipFile(io.BytesIO(raw_bytes)) as archive:
        section_names = sorted(
            name
            for name in archive.namelist()
            if name.startswith("Contents/section") and name.endswith(".xml")
        )
        for name in section_names:
            xml_bytes = archive.read(name)
            root = ET.fromstring(xml_bytes)
            for elem in root.iter():
                if elem.text and elem.text.strip():
                    texts.append(elem.text.strip())
    return "\n".join(texts)


class FixtureRepository:
    def __init__(self, fixture_dir: Path) -> None:
        self.fixture_dir = fixture_dir

    def _read_json(self, filename: str) -> Any:
        path = self.fixture_dir / filename
        if not path.is_file():
            raise FixtureNotFoundError(f"Missing fixture: {filename}")
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)

    def get_policy_snapshot(self, as_of: str, region_code: str) -> PolicySnapshot:
        snapshot = PolicySnapshot.model_validate(self._read_json("policy_snapshot.json"))
        if snapshot.as_of.isoformat() != as_of or snapshot.region.code != region_code:
            raise FixtureNotFoundError(
                "The demo fixture supports only 2025-06-28 and region 11680."
            )
        return snapshot

    def get_claims(self) -> list[dict[str, Any]]:
        raw_claims = self._read_json("claims.json")
        if not isinstance(raw_claims, list):
            raise ValueError("claims.json must contain a JSON array")
        validated = [Claim.model_validate(item).model_dump(mode="json") for item in raw_claims]
        return validated

    def get_typed_claims(self) -> list[Claim]:
        raw_claims = self._read_json("claims.json")
        if not isinstance(raw_claims, list):
            raise ValueError("claims.json must contain a JSON array")
        return [Claim.model_validate(item) for item in raw_claims]

    def _ensure_all_region_causal_chains(
        self, result: ScenarioResult
    ) -> dict[str, list[CausalNode]]:
        chains: dict[str, list[CausalNode]] = (
            dict(result.structured_causal_chains) if result.structured_causal_chains else {}
        )
        for region in result.regions:
            if region.region_code in chains and len(chains[region.region_code]) == 5:
                continue
            chains[region.region_code] = self._build_default_region_chain(region)
        return chains

    def _build_default_region_chain(self, region: RegionResult) -> list[CausalNode]:
        rule_id = (
            region.driving_rule_ids[0] if region.driving_rule_ids else "demo_rule_mortgage_cap"
        )
        claims = region.supporting_claim_ids or ["CL-KDI23-LTP-PRICE-DIRECT"]
        mech_key = region.primary_mechanism or "borrowing_capacity"
        mech_label = MECHANISM_LABELS.get(mech_key, mech_key)

        if region.effect_type == "direct":
            rule_label = "주담대 한도 6억 제한 및 토지거래허가구역 실거주 의무"
            rule_detail = (
                f"{region.region_name} 내 고가 아파트 매수 시 "
                "차입 상한과 실거주 요건이 동시에 강화됩니다."
            )
            behavior_label = "레버리지 실수요 및 갭투자 매수세 위축, 관망 전환"
            behavior_detail = (
                "기존 주택 처분 기한(6개월) 단축과 대출 한도 축소로 "
                "갈아타기 및 투자 수요가 보류됩니다."
            )
            shift_label = f"{region.region_name} 직격탄 권역 매수 문의 급감 및 인접지 이탈"
            shift_detail = (
                "초고가 현금 매수자 외 일반 차입 가구의 유효 수요가 "
                "중저가 또는 비규제 인접 권역으로 분산됩니다."
            )
        else:
            rule_label = "규제 권역 대출 상한 신설 및 정책모기지 우대 유지"
            rule_detail = (
                f"인접 핵심 권역 규제 강화와 맞물려 {region.region_name} "
                "중저가 및 대체 단지로의 상대적 진입 여건이 부각됩니다."
            )
            behavior_label = "예산 제약 가구 및 신혼 실수요층의 대체 주거지 탐색"
            behavior_detail = (
                "차입 한도 내에서 매수 가능한 아파트를 찾아 "
                "규제 직격 구역에서 대체 권역으로 탐색 범위를 이동합니다."
            )
            shift_label = f"{region.region_name} 대체 수요 유입 (공간 전이 효과)"
            shift_detail = (
                "인접 규제 지역에서 이탈한 실수요가 유입되며 "
                "거래량과 가격 방어력이 상대적으로 높게 유지됩니다."
            )

        p_low, p_high = region.price_change.low, region.price_change.high
        t_low, t_high = region.transaction_change.low, region.transaction_change.high
        outcome_label = (
            f"{region.region_name} 가격 {p_low:+.1f}%~{p_high:+.1f}%, "
            f"거래량 {t_low:+.1f}%~{t_high:+.1f}%"
        )
        outcome_detail = (
            "합성 시나리오 범위이며 실증 연구의 방향성 근거와 결합된 정책 시뮬레이션 결과입니다."
        )

        return [
            CausalNode(
                node_id=f"chain_{region.region_code}_1",
                stage="policy_rule",
                label=rule_label,
                detail=rule_detail,
                is_uncertain=False,
                rule_id=rule_id,
                claim_ids=claims[:1],
                data_fields=["parameters.max_mortgage_amount_krw", "applies_to.region_codes"],
            ),
            CausalNode(
                node_id=f"chain_{region.region_code}_2",
                stage="mechanism",
                label=mech_label,
                detail=(
                    "차입 한도 및 거래 자격 규제가 가구의 유효 구매력과 "
                    "거래 가능 집합을 변화시킵니다."
                ),
                is_uncertain=False,
                rule_id=rule_id,
                claim_ids=claims[:2],
                data_fields=["mechanisms", "max_loan_after_krw"],
            ),
            CausalNode(
                node_id=f"chain_{region.region_code}_3",
                stage="household_behavior",
                label=behavior_label,
                detail=behavior_detail,
                is_uncertain=region.effect_type == "spillover",
                rule_id=rule_id,
                claim_ids=claims,
                data_fields=["action_probabilities_after", "selectable_regions_after"],
            ),
            CausalNode(
                node_id=f"chain_{region.region_code}_4",
                stage="demand_shift",
                label=shift_label,
                detail=shift_detail,
                is_uncertain=region.effect_type == "spillover",
                rule_id=rule_id,
                claim_ids=claims,
                data_fields=["spillover_from_region_codes", "related_cohort_ids"],
            ),
            CausalNode(
                node_id=f"chain_{region.region_code}_5",
                stage="regional_outcome",
                label=outcome_label,
                detail=outcome_detail,
                is_uncertain=True,
                rule_id=rule_id,
                claim_ids=claims,
                data_fields=["price_change", "transaction_change", "mortgage_limit_change"],
            ),
        ]

    def _scale_range(self, value_range: ValueRange, multiplier: float) -> ValueRange:
        scaled_low = round(value_range.low * multiplier, 1)
        scaled_high = round(value_range.high * multiplier, 1)
        low, high = (
            (scaled_low, scaled_high) if scaled_low <= scaled_high else (scaled_high, scaled_low)
        )
        median = (
            round(value_range.median * multiplier, 1)
            if value_range.median is not None
            else round((low + high) / 2, 1)
        )
        ci_low = (
            round(value_range.ci80_low * multiplier, 1)
            if value_range.ci80_low is not None
            else round(low + (high - low) * 0.2, 1)
        )
        ci_high = (
            round(value_range.ci80_high * multiplier, 1)
            if value_range.ci80_high is not None
            else round(high - (high - low) * 0.2, 1)
        )
        if ci_low > ci_high:
            ci_low, ci_high = ci_high, ci_low
        return ValueRange(
            low=low,
            median=median,
            high=high,
            ci80_low=ci_low,
            ci80_high=ci_high,
            unit=value_range.unit,
        )

    def _include_seoul_districts(self, result: ScenarioResult) -> ScenarioResult:
        existing = {r.region_code for r in result.regions}
        for boundary in load_public_context().boundaries:
            code = boundary.region_code
            if not boundary.code.startswith("11") or not code or code in existing:
                continue
            result.regions.append(
                RegionResult(
                    region_code=code,
                    region_name=f"서울 {boundary.name}",
                    price_change=None,
                    transaction_change=None,
                    confidence="low",
                    effect_type="baseline",
                    coverage_status="context_only",
                    driving_rule_ids=[],
                    supporting_claim_ids=[],
                    related_cohort_ids=[],
                    spillover_from_region_codes=[],
                )
            )
            if result.structured_causal_chains is not None:
                result.structured_causal_chains[code] = []
            existing.add(code)
        return result

    def get_scenario_result(self, request: ScenarioRequest | None = None) -> ScenarioResult:
        result = ScenarioResult.model_validate(self._read_json("scenario_result.json"))
        result.structured_causal_chains = self._ensure_all_region_causal_chains(result)

        if request is None:
            return self._include_seoul_districts(result)

        horizon = request.horizon_months
        if horizon in HORIZON_FACTORS:
            price_mult, tx_mult, horizon_label = HORIZON_FACTORS[horizon]
        elif horizon < 3:
            price_mult, tx_mult, horizon_label = (0.50, 0.80, f"{horizon}개월 후")
        elif horizon < 6:
            price_mult, tx_mult, horizon_label = (0.85, 1.10, f"{horizon}개월 후")
        else:
            price_mult, tx_mult, horizon_label = (0.85, 0.72, f"{horizon}개월 후")

        selected = set(request.change_ids)
        snapshot = self.get_policy_snapshot(request.baseline_date.isoformat(), request.region_code)
        end_date = _months_after(request.baseline_date, horizon)
        active = {
            rule.rule_id for rule in snapshot.rules
            if rule.rule_id in selected
            and (rule.effective_from is None or rule.effective_from <= end_date)
            and (rule.effective_to is None or rule.effective_to >= end_date)
        }
        household_active = active - {"demo_rule_policy_loan_exception"}
        _recalculate_cohorts(result, household_active, min(1.0, price_mult))
        rule_weight = min(1.0, len(household_active) / 4) if household_active else 0.0
        rate_adj = 1.0 + (request.base_rate_delta_bp / 500.0)
        combined_price_mult = price_mult * rule_weight * rate_adj
        combined_tx_mult = tx_mult * rule_weight

        for region in result.regions:
            if region.effect_type == "spillover" and horizon == 0:
                # Immediate horizon has minimal spatial spillover compared to 3~6m
                region.price_change = self._scale_range(region.price_change, 0.25 * rule_weight)
                region.transaction_change = self._scale_range(
                    region.transaction_change, 0.30 * rule_weight
                )
            else:
                region.price_change = self._scale_range(region.price_change, combined_price_mult)
                region.transaction_change = self._scale_range(
                    region.transaction_change, combined_tx_mult
                )

            if region.mortgage_limit_change is not None:
                loan_mult = (
                    1.0 if household_active & {
                        "demo_rule_mortgage_cap", "demo_rule_stress_dsr_phase3"
                    } else 0.0
                )
                region.mortgage_limit_change = self._scale_range(
                    region.mortgage_limit_change, loan_mult
                )

        result.horizon_months = horizon
        result.model_version = "synthetic-sensitivity-0.2.0"
        result.scenario_id = "demo_scenario_" + hashlib.sha256(json.dumps({
            "date": request.baseline_date.isoformat(), "region": request.region_code,
            "horizon": horizon, "rules": sorted(active), "rate_bp": request.base_rate_delta_bp,
        }, sort_keys=True).encode()).hexdigest()[:16]
        result.limitations.append(
            "가구 예산과 행동 비중은 선택한 유효 규칙 수와 기간에 따라 "
            "6개월 합성 예시 변화량을 가중한 민감도입니다. 실측 행동 확률이나 "
            "규칙별 검증 효과가 아닙니다."
        )
        result.structured_causal_chains = self._ensure_all_region_causal_chains(result)
        for region in result.regions:
            chain = result.structured_causal_chains.get(region.region_code, [])
            if chain:
                chain[0].label = (
                    f"적용된 변경 규칙 {len(active)}개"
                    if active else "변경 규칙 없음"
                )
                chain[2].label = (
                    f"가구 예산과 행동 비중을 {len(household_active)}개 변경 규칙으로 계산"
                    if household_active else "가구 예산과 행동 비중은 기준 상태 유지"
                )
                if not household_active:
                    chain[1].label = "변경된 구매력 제약 없음"
                    chain[3].label = "정책 변경으로 인한 추가 수요 이동 없음"
                p_low, p_high = region.price_change.low, region.price_change.high
                t_low, t_high = region.transaction_change.low, region.transaction_change.high
                chain[-1].label = (
                    f"{region.region_name} ({horizon_label}) 가격 "
                    f"{p_low:+.1f}%~{p_high:+.1f}%, "
                    f"거래량 {t_low:+.1f}%~{t_high:+.1f}%"
                )

        result.summary = (
            f"합성 시나리오 기준({horizon_label}): 선택한 {len(active)}개 변경 규칙 중 "
            f"{len(household_active)}개를 가구 민감도에 반영했습니다. "
            "지역별 가격과 거래량은 별도의 합성 범위 계산입니다."
        )
        return self._include_seoul_districts(result)

    def extract_policy_document(self, request: PolicyExtractRequest) -> PolicyExtractResponse:
        snapshot = PolicySnapshot.model_validate(self._read_json("policy_snapshot.json"))
        raw_content = (
            request.content_text or snapshot.package_title or "demo_policy_input"
        ).encode("utf-8")
        digest = hashlib.sha256(raw_content).hexdigest()

        format_map: dict[str, str] = {
            "text": "TEXT",
            "pdf": "PDF",
            "sample": "PDF",
            "hwpx": "HWPX",
            "hwp": "HWP",
        }
        doc_format = format_map.get(request.input_type, "TEXT")
        is_hwp_fallback = request.input_type == "hwp"

        if snapshot.document_provenance is not None:
            snapshot.document_provenance.format = doc_format  # type: ignore[assignment]
            if request.filename:
                snapshot.document_provenance.filename = request.filename
            if request.authority:
                snapshot.document_provenance.authority = request.authority
            if request.announced_at:
                snapshot.document_provenance.announced_at = request.announced_at
            snapshot.document_provenance.document_hash = f"sha256:{digest}"
            snapshot.document_provenance.extraction_status = (
                "FAILED_FALLBACK_TEXT" if is_hwp_fallback else "COMPLETED"
            )
            snapshot.document_provenance.cache_status = (
                "VERIFIED_SNAPSHOT_CACHE"
                if request.use_verified_cache
                else "LIVE_EXTRACTION_SYNTHETIC"
            )

        doc_name = request.filename or "정책 원문"
        steps: list[ExtractionStepStatus] = [
            ExtractionStepStatus(
                step=1,
                code="READING_DOC",
                label="정책 문서를 읽는 중",
                status="fallback_warning" if is_hwp_fallback else "completed",
                detail=(
                    "구형 HWP 바이너리 표 일부를 직접 해독할 수 없어 공식 고시 텍스트 및 "
                    "검증 스냅샷 캐시로 대체했습니다."
                    if is_hwp_fallback
                    else f"{doc_format} 문서({doc_name})에서 텍스트와 표 구조를 추출했습니다."
                ),
            ),
            ExtractionStepStatus(
                step=2,
                code="FINDING_DIFF",
                label="기존 규정과 달라진 조항을 찾는 중",
                status="completed",
                detail=(
                    "대상 지역, 차주 요건, 시행일, 수치 파라미터 기준으로 "
                    "5개 원자적 규칙의 개정 전후 차이를 분리했습니다."
                ),
            ),
            ExtractionStepStatus(
                step=3,
                code="LINKING_TARGET",
                label="영향받는 지역과 가구 유형을 연결하는 중",
                status="completed",
                detail=(
                    "수도권 11개 핵심 권역과 JEV 4대 가구 코호트"
                    "(무주택 신혼부부, 고DSR 실수요자, 갈아타기, 다주택자)를 매핑했습니다."
                ),
            ),
            ExtractionStepStatus(
                step=4,
                code="CHECKING_EVIDENCE",
                label="연구 근거와 주의사항을 확인하는 중",
                status="completed",
                detail=(
                    "KDI 및 한국은행 실증 연구 주장(26개 Claim)과 "
                    "단기 대 중장기 상충 근거를 연결했습니다."
                ),
            ),
        ]

        fallback_message = (
            "HWP 바이너리 문서의 표 구조 일부를 직접 해독할 수 없어 "
            "사전 검증된 고시 원문 텍스트 및 스냅샷 캐시로 대체하여 규칙 차이를 추출했습니다."
            if is_hwp_fallback
            else None
        )

        tightened_count = sum(1 for r in snapshot.rules if r.change_type in {"tightened", "new"})
        unchanged_count = sum(1 for r in snapshot.rules if r.change_type == "unchanged")
        diff_summary = (
            f"총 {len(snapshot.rules)}개 원자적 정책 규칙 추출 완료 "
            f"(강화 또는 신설 {tightened_count}건, 실수요 보호 예외 유지 {unchanged_count}건)"
        )

        return PolicyExtractResponse(
            snapshot=snapshot,
            extraction_steps=steps,
            fallback_message=fallback_message,
            diff_summary=diff_summary,
            is_investment_advice=False,
        )

    def get_graph(self, as_of: str, region_code: str) -> GraphResponse:
        snapshot = self.get_policy_snapshot(as_of, region_code)
        result = self.get_scenario_result()
        claims = self.get_typed_claims()

        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []
        seen_nodes: set[str] = set()

        def add_node(
            node_id: str,
            label: str,
            kind: str,
            status: str | None = None,
            metadata: dict[str, Any] | None = None,
        ) -> None:
            if node_id not in seen_nodes:
                nodes.append(
                    GraphNode(
                        id=node_id,
                        label=label,
                        kind=kind,
                        status=status,
                        metadata=metadata,
                    )
                )
                seen_nodes.add(node_id)

        # 1. PolicyPackage & Measures & PolicyRules & LegalSources
        pkg_id = "demo_pkg_2025_06_debt_and_land"
        add_node(
            pkg_id,
            snapshot.package_title or "수도권 주담대 및 토지거래허가 패키지",
            "policy_package",
            status=snapshot.data_status.value,
        )

        for rule in snapshot.rules:
            measure_id = rule.measure_id or f"measure:{rule.rule_id}"
            add_node(
                measure_id,
                f"{rule.category.upper()} 정책수단 ({rule.title[:18]})",
                "measure",
                status=rule.verification_status,
            )
            edges.append(GraphEdge(source=pkg_id, target=measure_id, relation="CONTAINS"))

            add_node(
                rule.rule_id,
                rule.title,
                "policy_rule",
                status=rule.verification_status,
                metadata={
                    "category": rule.category,
                    "change_type": rule.change_type,
                    "effective_from": rule.effective_from.isoformat()
                    if rule.effective_from
                    else None,
                },
            )
            edges.append(GraphEdge(source=measure_id, target=rule.rule_id, relation="IMPLEMENTS"))

            if rule.previous_rule_id:
                add_node(
                    rule.previous_rule_id,
                    rule.previous_summary or f"종전 규정 ({rule.previous_rule_id})",
                    "policy_rule",
                    status="historical",
                )
                edges.append(
                    GraphEdge(
                        source=rule.rule_id,
                        target=rule.previous_rule_id,
                        relation="SUPERSEDES",
                    )
                )

            source_node_id = f"legal_source:{rule.rule_id}"
            add_node(
                source_node_id,
                f"{rule.source.authority} ({rule.source.locator})",
                "legal_source",
                status="official" if rule.source.is_official else "synthetic",
            )
            edges.append(
                GraphEdge(
                    source=rule.rule_id,
                    target=source_node_id,
                    relation="DERIVED_FROM",
                )
            )

            for mechanism in rule.mechanisms:
                mechanism_id = f"mechanism:{mechanism}"
                add_node(
                    mechanism_id,
                    MECHANISM_LABELS.get(mechanism, mechanism.replace("_", " ")),
                    "mechanism",
                    status="active",
                )
                edges.append(
                    GraphEdge(
                        source=rule.rule_id,
                        target=mechanism_id,
                        relation="ACTS_THROUGH",
                    )
                )

            if rule.relations:
                for rel in rule.relations:
                    edges.append(
                        GraphEdge(
                            source=rule.rule_id,
                            target=rel.target_rule_id,
                            relation=rel.relation,
                            metadata={"note": rel.note} if rel.note else None,
                        )
                    )

        # 2. Market Metrics
        metric_defs = [
            ("metric:housing_price", "주택 매매가격 변동률"),
            ("metric:transaction_volume", "아파트 매매 거래량 변동률"),
            ("metric:borrowing_limit", "가구별 유효 대출한도"),
            ("metric:jeonse_to_price_ratio", "전세가율 및 갭투자 여력"),
        ]
        for metric_id, metric_label in metric_defs:
            add_node(metric_id, metric_label, "market_metric", status="tracked")

        # 3. Regions & Spatial Relations
        add_node("region:11000", "서울특별시", "region", status="administrative")
        region_name_to_code: dict[str, str] = {}
        for region in result.regions:
            region_name_to_code[region.region_name] = region.region_code
            short_name = region.region_name.split()[-1]
            region_name_to_code[short_name] = region.region_code
            region_node_id = f"region:{region.region_code}"
            add_node(
                region_node_id,
                region.region_name,
                "region",
                status=region.effect_type,
                metadata={
                    "region_code": region.region_code,
                    "effect_type": region.effect_type,
                    "confidence": region.confidence,
                    "coverage_status": region.coverage_status,
                },
            )
            if region.region_code.startswith("11"):
                edges.append(
                    GraphEdge(source="region:11000", target=region_node_id, relation="CONTAINS")
                )
            if region.driving_rule_ids:
                for r_id in region.driving_rule_ids:
                    edges.append(
                        GraphEdge(
                            source=r_id,
                            target=region_node_id,
                            relation="APPLIES_TO",
                        )
                    )
                    edges.append(
                        GraphEdge(
                            source=r_id,
                            target=region_node_id,
                            relation=(
                                "DIRECT_EFFECT"
                                if region.effect_type == "direct"
                                else "SPILLOVER_EFFECT"
                            ),
                        )
                    )
            if region.primary_mechanism:
                mech_id = f"mechanism:{region.primary_mechanism}"
                add_node(
                    mech_id,
                    MECHANISM_LABELS.get(region.primary_mechanism, region.primary_mechanism),
                    "mechanism",
                    status="active",
                )
                edges.append(
                    GraphEdge(
                        source=mech_id,
                        target=region_node_id,
                        relation="AFFECTS",
                    )
                )
                edges.append(
                    GraphEdge(
                        source=mech_id,
                        target="metric:housing_price",
                        relation="AFFECTS",
                    )
                )
                edges.append(
                    GraphEdge(
                        source=mech_id,
                        target="metric:transaction_volume",
                        relation="AFFECTS",
                    )
                )
            if region.spillover_from_region_codes:
                for origin_code in region.spillover_from_region_codes:
                    origin_node_id = f"region:{origin_code}"
                    edges.append(
                        GraphEdge(
                            source=origin_node_id,
                            target=region_node_id,
                            relation="SPILLOVER_TO",
                        )
                    )
                    edges.append(
                        GraphEdge(
                            source=region_node_id,
                            target=origin_node_id,
                            relation="SUBSTITUTE_FOR",
                        )
                    )

        # 4. Household Cohorts (JEV)
        for cohort in result.cohorts:
            add_node(
                cohort.cohort_id,
                cohort.label,
                "household_cohort",
                status="simulated",
                metadata={"exposure": cohort.exposure},
            )
            if cohort.driving_rule_ids:
                for r_id in cohort.driving_rule_ids:
                    edges.append(
                        GraphEdge(
                            source=r_id,
                            target=cohort.cohort_id,
                            relation="APPLIES_TO",
                        )
                    )
            if cohort.selectable_regions_after:
                for reg_label in cohort.selectable_regions_after:
                    resolved_code = region_name_to_code.get(reg_label)
                    if not resolved_code:
                        for name_key, code_val in region_name_to_code.items():
                            if name_key in reg_label or reg_label in name_key:
                                resolved_code = code_val
                                break
                    target_node_id = (
                        f"region:{resolved_code}" if resolved_code else f"region:{reg_label}"
                    )
                    edges.append(
                        GraphEdge(
                            source=cohort.cohort_id,
                            target=target_node_id,
                            relation="SUBSTITUTES_TO",
                        )
                    )

        # 5. Evidence & Claims
        for claim in claims:
            ev_id = claim.evidence_id or "EV-DEMO-SYNTHETIC"
            add_node(
                ev_id,
                f"{claim.source.publisher} - {claim.source.title}",
                "evidence",
                status=claim.source.review_status or "verified",
            )
            add_node(
                claim.claim_id,
                claim.title or f"{claim.policy_type} -> {claim.outcome_metric}",
                "claim",
                status=f"grade_{claim.evidence_grade}",
                metadata={
                    "evidence_grade": claim.evidence_grade,
                    "effect_direction": claim.effect_direction,
                    "effect_value": claim.effect_value,
                    "scenario_match": claim.scenario_match,
                },
            )
            edges.append(
                GraphEdge(
                    source=ev_id,
                    target=claim.claim_id,
                    relation="MAKES_CLAIM",
                )
            )
            metric_target = "metric:housing_price"
            if "volume" in claim.outcome_metric or "transaction" in claim.outcome_metric:
                metric_target = "metric:transaction_volume"
            elif any(k in claim.outcome_metric for k in ("debt", "credit", "loan")):
                metric_target = "metric:borrowing_limit"
            elif "tenure" in claim.outcome_metric or "jeonse" in claim.outcome_metric:
                metric_target = "metric:jeonse_to_price_ratio"
            edges.append(
                GraphEdge(
                    source=claim.claim_id,
                    target=metric_target,
                    relation="ABOUT",
                )
            )
            if claim.mechanisms:
                for mech in claim.mechanisms:
                    mech_id = f"mechanism:{mech}"
                    add_node(
                        mech_id,
                        MECHANISM_LABELS.get(mech, mech.replace("_", " ")),
                        "mechanism",
                        status="active",
                    )
                    edges.append(
                        GraphEdge(
                            source=claim.claim_id,
                            target=mech_id,
                            relation="ABOUT",
                        )
                    )
            if claim.related_claims:
                for link in claim.related_claims:
                    edges.append(
                        GraphEdge(
                            source=claim.claim_id,
                            target=link.claim_id,
                            relation=link.relation,
                            metadata={"reason": link.reason} if link.reason else None,
                        )
                    )

        return GraphResponse(
            data_status=DataStatus.DEMO_INCOMPLETE,
            is_investment_advice=False,
            nodes=nodes,
            edges=edges,
            limitations=snapshot.coverage.limitations,
        )
