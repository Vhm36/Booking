#!/usr/bin/env python3
import json
import math
import random
import sys
from datetime import date, datetime


SEGMENT_LABELS = [
    "Champions",
    "Loyal Customers",
    "Potential Loyalists",
    "Need Attention",
    "At Risk",
]

DEC_CLUSTER_KEYS = [
    "frequent_single_service",
    "frequent_cancel_no_show",
    "many_bookings_low_arrival",
    "low_usage_premium",
    "high_usage_budget",
    "one_time_then_left",
    "low_monthly_usage",
]


def to_number(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def to_int(value, default=0):
    return int(to_number(value, default))


def round_js(value, digits=1):
    factor = 10 ** digits
    return math.floor(to_number(value) * factor + 0.5) / factor


def quantile(values, q):
    sorted_values = sorted(
        value for value in (to_number(item) for item in values)
        if math.isfinite(value) and value > 0
    )

    if not sorted_values:
        return 0
    if len(sorted_values) == 1:
        return sorted_values[0]

    position = (len(sorted_values) - 1) * q
    base = math.floor(position)
    rest = position - base

    if base + 1 >= len(sorted_values):
        return sorted_values[base]

    return sorted_values[base] + rest * (sorted_values[base + 1] - sorted_values[base])


def parse_date(value):
    if not value:
        return None

    raw = str(value).strip()
    if not raw:
        return None

    if len(raw) >= 10:
        try:
            return datetime.strptime(raw[:10], "%Y-%m-%d").date()
        except ValueError:
            pass

    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def days_since(value, today=None):
    parsed = parse_date(value)
    if parsed is None:
        return 999

    today = today or date.today()
    return max(0, (today - parsed).days)


def standard_scale(rows, feature_keys):
    means = {}
    stds = {}

    for key in feature_keys:
        values = [to_number(row.get(key)) for row in rows]
        mean = sum(values) / len(values) if values else 0
        variance = sum((value - mean) ** 2 for value in values) / len(values) if values else 0
        means[key] = mean
        stds[key] = math.sqrt(variance)

    scaled_rows = []
    for row in rows:
        scaled = dict(row)
        for key in feature_keys:
            value = to_number(row.get(key))
            scaled[f"{key}_norm"] = 0 if stds[key] == 0 else (value - means[key]) / stds[key]
        scaled_rows.append(scaled)

    return {
        "normalized": scaled_rows,
        "means": means,
        "stds": stds,
    }


def euclidean_distance(point, centroid, feature_keys):
    total = 0
    for key in feature_keys:
        diff = to_number(point.get(f"{key}_norm")) - to_number(centroid.get(key))
        total += diff * diff
    return math.sqrt(total)


def init_centroids_kmeans_pp(rows, k, feature_keys, seed=42):
    rng = random.Random(seed)
    centroids = []
    first_idx = rng.randrange(len(rows))
    centroids.append({
        key: to_number(rows[first_idx].get(f"{key}_norm"))
        for key in feature_keys
    })

    selected = {first_idx}
    for cluster_index in range(1, k):
        distances = []
        for point in rows:
            min_dist = min(euclidean_distance(point, centroid, feature_keys) for centroid in centroids)
            distances.append(min_dist * min_dist)

        total_dist = sum(distances)
        if total_dist <= 0:
            selected_idx = cluster_index % len(rows)
            while selected_idx in selected and len(selected) < len(rows):
                selected_idx = (selected_idx + 1) % len(rows)
        else:
            threshold = rng.random() * total_dist
            selected_idx = 0
            for idx, distance in enumerate(distances):
                threshold -= distance
                if threshold <= 0:
                    selected_idx = idx
                    break

        selected.add(selected_idx)
        centroids.append({
            key: to_number(rows[selected_idx].get(f"{key}_norm"))
            for key in feature_keys
        })

    return centroids


def run_kmeans_iterations(rows, k, feature_keys, max_iterations=100):
    if len(rows) <= k:
        return {
            "assignments": list(range(len(rows))),
            "centroids": [
                {key: to_number(point.get(f"{key}_norm")) for key in feature_keys}
                for point in rows
            ],
            "iterations": 0,
        }

    centroids = init_centroids_kmeans_pp(rows, k, feature_keys)
    assignments = [0 for _ in rows]
    iterations = 0

    for iteration in range(max_iterations):
        iterations = iteration + 1
        new_assignments = []

        for point in rows:
            distances = [
                euclidean_distance(point, centroid, feature_keys)
                for centroid in centroids
            ]
            new_assignments.append(min(range(len(distances)), key=lambda idx: distances[idx]))

        changed = new_assignments != assignments
        assignments = new_assignments

        if not changed:
            break

        next_centroids = []
        for cluster_idx in range(k):
            members = [
                point for point, assignment in zip(rows, assignments)
                if assignment == cluster_idx
            ]
            if not members:
                next_centroids.append({key: 0 for key in feature_keys})
                continue

            next_centroids.append({
                key: sum(to_number(member.get(f"{key}_norm")) for member in members) / len(members)
                for key in feature_keys
            })

        centroids = next_centroids

    return {
        "assignments": assignments,
        "centroids": centroids,
        "iterations": iterations,
    }


def score_centroid(centroid):
    return (
        -to_number(centroid.get("recency")) * 0.25
        + to_number(centroid.get("frequency")) * 0.30
        + to_number(centroid.get("monetary")) * 0.30
        - to_number(centroid.get("cancel_rate")) * 0.15
    )


def assign_cluster_labels(centroids):
    scored = [
        {
            "original_idx": idx,
            "score": score_centroid(centroid),
            "centroid": centroid,
        }
        for idx, centroid in enumerate(centroids)
    ]
    scored.sort(key=lambda item: item["score"], reverse=True)

    labels = {}
    for rank, item in enumerate(scored):
        labels[item["original_idx"]] = SEGMENT_LABELS[min(rank, len(SEGMENT_LABELS) - 1)]

    return labels


def run_kmeans(payload):
    customers = payload.get("customers") or []
    feature_keys = payload.get("feature_keys") or ["recency", "frequency", "monetary", "cancel_rate"]
    k = max(1, to_int(payload.get("k"), 5))
    max_iterations = max(1, to_int(payload.get("max_iterations"), 100))

    if not customers:
        return {
            "total": 0,
            "segments": {},
            "details": [],
            "centroids": [],
            "iterations": 0,
            "method": "python_kmeans_standard_scaler",
        }

    scaled = standard_scale(customers, feature_keys)
    normalized = scaled["normalized"]
    actual_k = min(k, len(normalized))
    result = run_kmeans_iterations(normalized, actual_k, feature_keys, max_iterations)
    label_map = assign_cluster_labels(result["centroids"])

    details = []
    segments = {}
    for customer, cluster_id in zip(normalized, result["assignments"]):
        segment = label_map.get(cluster_id, SEGMENT_LABELS[-1])
        segments[segment] = segments.get(segment, 0) + 1
        details.append({
            "customer_id": customer.get("customer_id"),
            "name": customer.get("name"),
            "email": customer.get("email"),
            "recency": to_number(customer.get("recency")),
            "frequency": to_number(customer.get("frequency")),
            "monetary": to_number(customer.get("monetary")),
            "cancel_rate": to_number(customer.get("cancel_rate")),
            "cluster_id": cluster_id,
            "segment": segment,
        })

    return {
        "total": len(details),
        "segments": segments,
        "details": details,
        "centroids": result["centroids"],
        "iterations": result["iterations"],
        "actual_k": actual_k,
        "means": scaled["means"],
        "stds": scaled["stds"],
        "method": "python_kmeans_standard_scaler",
    }


def segment_customer(r_score, f_score, m_score):
    r_score = to_number(r_score)
    f_score = to_number(f_score)
    m_score = to_number(m_score)

    if r_score >= 4 and f_score >= 4 and m_score >= 4:
        return "Champions"
    if f_score >= 4 and m_score >= 4:
        return "Loyal Customers"
    if (f_score >= 3 or m_score >= 3) and r_score >= 2:
        return "Potential Loyalists"
    if m_score >= 3 and r_score <= 2:
        return "At Risk"
    if r_score <= 2 and f_score <= 2:
        return "Lost Customers"
    if f_score <= 2:
        return "New Customers"
    return "Need Attention"


def score_rfm(customers):
    if not customers:
        return []

    def assign_score(sorted_rows):
        scores = {}
        total = len(sorted_rows)
        for idx, item in enumerate(sorted_rows):
            percentile = idx / total
            if percentile < 0.25:
                score = 4
            elif percentile < 0.5:
                score = 3
            elif percentile < 0.75:
                score = 2
            else:
                score = 1
            scores[item.get("customer_id")] = score
        return scores

    r_scores = assign_score(sorted(customers, key=lambda item: to_number(item.get("recency"))))
    f_scores = assign_score(sorted(customers, key=lambda item: to_number(item.get("frequency")), reverse=True))
    m_scores = assign_score(sorted(customers, key=lambda item: to_number(item.get("monetary")), reverse=True))

    scored = []
    for customer in customers:
        customer_id = customer.get("customer_id")
        r_score = r_scores.get(customer_id, 1)
        f_score = f_scores.get(customer_id, 1)
        m_score = m_scores.get(customer_id, 1)
        scored.append({
            **customer,
            "r_score": r_score,
            "f_score": f_score,
            "m_score": m_score,
            "rfm_score": f"{r_score}{f_score}{m_score}",
        })

    return scored


def run_rfm(payload):
    customers = payload.get("customers") or []
    scored = score_rfm(customers)
    details = []
    segments = {}

    for customer in scored:
        segment = segment_customer(customer.get("r_score"), customer.get("f_score"), customer.get("m_score"))
        segments[segment] = segments.get(segment, 0) + 1
        details.append({
            **customer,
            "segment": segment,
        })

    return {
        "total": len(details),
        "segments": segments,
        "details": details,
        "method": "python_rfm_quartile",
    }


def build_service_usage_map(rows):
    usage = {}
    for row in rows or []:
        customer_id = to_int(row.get("customer_id"))
        usage.setdefault(customer_id, []).append({
            "service_id": row.get("service_id"),
            "service_name": row.get("service_name") or "Không rõ",
            "booking_count": to_number(row.get("booking_count")),
            "avg_price": to_number(row.get("avg_price")),
        })
    return usage


def get_favorite_service(services):
    if not services:
        return {"name": "Chưa có dịch vụ", "booking_count": 0}

    favorite = sorted(
        services,
        key=lambda item: (to_number(item.get("booking_count")), to_number(item.get("avg_price"))),
        reverse=True,
    )[0]
    return {
        "name": favorite.get("service_name") or "Không rõ",
        "booking_count": favorite.get("booking_count") or 0,
    }


def normalize_dec_customer(row, service_usage_map, today):
    customer_id = to_int(row.get("customer_id"))
    total_bookings = to_number(row.get("total_bookings"))
    completed_bookings = to_number(row.get("completed_bookings"))
    cancelled_bookings = to_number(row.get("cancelled_bookings"))
    no_show_bookings = to_number(row.get("no_show_bookings"))
    risk_bookings = cancelled_bookings + no_show_bookings
    completed_revenue = to_number(row.get("completed_revenue"))
    avg_completed_amount = to_number(row.get("avg_completed_amount"))
    avg_cancellation_score = to_number(row.get("avg_cancellation_score"))
    active_months = max(0, to_number(row.get("active_months")))
    monthly_booking_rate = total_bookings / active_months if active_months > 0 else total_bookings
    service_usage = service_usage_map.get(customer_id, [])
    favorite_service = get_favorite_service(service_usage)

    return {
        "id": customer_id,
        "name": row.get("name") or "Khách hàng",
        "email": row.get("email") or "",
        "total_bookings": total_bookings,
        "completed_bookings": completed_bookings,
        "cancelled_bookings": cancelled_bookings,
        "no_show_bookings": no_show_bookings,
        "open_bookings": to_number(row.get("open_bookings")),
        "completed_revenue": completed_revenue,
        "avg_completed_amount": avg_completed_amount,
        "avg_cancellation_score": round_js(avg_cancellation_score, 1),
        "active_months": active_months,
        "monthly_booking_rate": round_js(monthly_booking_rate, 2),
        "distinct_services": len(service_usage),
        "favorite_service": favorite_service["name"],
        "favorite_service_count": favorite_service["booking_count"],
        "first_booking_date": row.get("first_booking_date"),
        "last_booking_date": row.get("last_booking_date"),
        "recency_days": days_since(row.get("last_booking_date"), today),
        "cancellation_rate": round_js((risk_bookings / total_bookings) * 100, 1) if total_bookings > 0 else 0,
        "completion_rate": round_js((completed_bookings / total_bookings) * 100, 1) if total_bookings > 0 else 0,
    }


def get_dec_cluster_key(customer, thresholds):
    if to_number(customer.get("total_bookings")) <= 0:
        return None

    risk_count = to_number(customer.get("cancelled_bookings")) + to_number(customer.get("no_show_bookings"))

    if (
        to_number(customer.get("total_bookings")) >= 6
        and to_number(customer.get("completion_rate")) <= 35
        and (to_number(customer.get("no_show_bookings")) >= 2 or risk_count >= 4)
    ):
        return "many_bookings_low_arrival"

    if (
        (risk_count >= 2 and to_number(customer.get("cancellation_rate")) >= 30)
        or to_number(customer.get("avg_cancellation_score")) >= 70
    ):
        return "frequent_cancel_no_show"

    if to_number(customer.get("total_bookings")) == 1 and to_number(customer.get("recency_days")) >= 21:
        return "one_time_then_left"

    if (
        to_number(customer.get("total_bookings")) >= 3
        and to_number(customer.get("completed_bookings")) >= 2
        and to_number(customer.get("distinct_services")) == 1
    ):
        return "frequent_single_service"

    if (
        to_number(customer.get("completed_bookings")) > 0
        and to_number(customer.get("completed_bookings")) <= 3
        and to_number(customer.get("avg_completed_amount")) >= to_number(thresholds.get("premium"))
    ):
        return "low_usage_premium"

    if (
        to_number(customer.get("completed_bookings")) >= 3
        and to_number(customer.get("avg_completed_amount")) > 0
        and to_number(customer.get("avg_completed_amount")) <= to_number(thresholds.get("budget"))
    ):
        return "high_usage_budget"

    if to_number(customer.get("active_months")) >= 2 and to_number(customer.get("monthly_booking_rate")) <= 1.25:
        return "low_monthly_usage"

    return None


def run_dec(payload):
    today = parse_date(payload.get("today")) or date.today()
    customer_rows = payload.get("customer_rows") or []
    service_usage_rows = payload.get("service_usage_rows") or []
    service_prices = payload.get("service_prices") or []
    has_period_filter = bool(payload.get("has_period_filter"))

    service_usage_map = build_service_usage_map(service_usage_rows)
    all_customers = [
        normalize_dec_customer(row, service_usage_map, today)
        for row in customer_rows
    ]
    customers = [
        customer for customer in all_customers
        if not has_period_filter or to_number(customer.get("total_bookings")) > 0
    ]

    amount_values = [
        to_number(customer.get("avg_completed_amount"))
        for customer in customers
        if to_number(customer.get("avg_completed_amount")) > 0
    ]
    price_basis = service_prices if service_prices else amount_values
    premium_threshold = quantile(price_basis, 0.75) or quantile(amount_values, 0.75) or 0
    budget_threshold = quantile(price_basis, 0.4) or quantile(amount_values, 0.4) or 0
    thresholds = {
        "premium": int(round_js(premium_threshold, 0)),
        "budget": int(round_js(budget_threshold, 0)),
    }

    clusters_by_key = {key: [] for key in DEC_CLUSTER_KEYS}
    unassigned = []
    clustered_count = 0

    for customer in customers:
        cluster_key = get_dec_cluster_key(customer, thresholds)
        if not cluster_key or cluster_key not in clusters_by_key:
            unassigned.append(customer)
            continue

        clustered_count += 1
        clusters_by_key[cluster_key].append({
            **customer,
            "cluster_key": cluster_key,
        })

    return {
        "customers": customers,
        "thresholds": thresholds,
        "clusters_by_key": clusters_by_key,
        "unassigned": unassigned,
        "clustered_count": clustered_count,
        "method": "python_dynamic_engagement_clustering",
    }


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    payload = json.load(sys.stdin)

    if mode == "standard_scale":
        result = standard_scale(payload.get("rows") or [], payload.get("feature_keys") or [])
    elif mode == "kmeans":
        result = run_kmeans(payload)
    elif mode == "rfm":
        result = run_rfm(payload)
    elif mode == "rfm_segment":
        result = {
            "segment": segment_customer(payload.get("r_score"), payload.get("f_score"), payload.get("m_score"))
        }
    elif mode == "dec":
        result = run_dec(payload)
    else:
        raise ValueError(f"Unsupported mode: {mode}")

    json.dump(result, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
