"""Reproduce the blog's declared-cost examples with the frozen LHOS planner.

Run with the 2026-10-22 candidate source on PYTHONPATH. No API or Docker is used.
The progress/work units below are constructed, never measured model reward.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from itertools import permutations
from pathlib import Path

from lhos.agent_os.context.demand import ActionDemand, ContextRepresentation
from lhos.agent_os.context.joint import JointActionContextPlanner, JointActionEstimate

CASES = {
    "preparation_changes_choice": {
        "budget": 5,
        "actions": {"A": {"G": 3, "P": 3, "E": 2}, "B": {"G": 2, "P": 0, "E": 2}, "C": {"G": 2, "P": 0, "E": 2}},
    },
    "one_step_heuristic_can_lose": {
        "budget": 6,
        "actions": {"A": {"G": 10, "P": 5, "E": 1}, "B": {"G": 7, "P": 2, "E": 2}},
    },
}


def execute(case: dict, policy: str) -> dict:
    remaining = case["budget"]
    active = dict(case["actions"])
    sequence = []
    progress = 0
    while active:
        plan = JointActionContextPlanner(selection_policy=policy, action_order=tuple(active)).plan(
            actions=tuple(ActionDemand(key, read_obligations=(key,)) for key in active),
            representations=tuple(ContextRepresentation("r-" + key, (key,), key, (("fixture", "1"),), 1) for key in active),
            estimates=tuple(JointActionEstimate(key, value["G"], value["E"], 1) for key, value in active.items()),
            preparation_costs={"r-" + key: value["P"] for key, value in active.items()},
            current_versions={"fixture": "1"}, context_budget_units=100,
            remaining_work_units=remaining, available_resource_units=1,
        )
        if not plan.allowed:
            break
        chosen = active.pop(plan.action_id)
        assert plan.total_work_units == chosen["P"] + chosen["E"]
        remaining -= plan.total_work_units
        progress += chosen["G"]
        sequence.append({"action": plan.action_id, **chosen, "total": plan.total_work_units})
    return {"sequence": sequence, "declared_progress": progress, "work_consumed": case["budget"] - remaining}


def optimum(case: dict) -> int:
    # A tiny exhaustive oracle for the independent constructed examples only.
    best = 0
    for length in range(len(case["actions"]) + 1):
        for order in permutations(case["actions"], length):
            work = sum(case["actions"][key]["P"] + case["actions"][key]["E"] for key in order)
            if work <= case["budget"]:
                best = max(best, sum(case["actions"][key]["G"] for key in order))
    return best


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    import lhos.agent_os.context.joint as implementation
    results = {name: {**case, "execution_cost_order": execute(case, "checkpoint_retrieval"),
                     "preparation_aware_order": execute(case, "joint"), "exhaustive_optimum": optimum(case)}
               for name, case in CASES.items()}
    positive = results["preparation_changes_choice"]
    negative = results["one_step_heuristic_can_lose"]
    assert positive["execution_cost_order"]["declared_progress"] == 3
    assert positive["preparation_aware_order"]["declared_progress"] == positive["exhaustive_optimum"] == 4
    assert negative["execution_cost_order"]["declared_progress"] == negative["exhaustive_optimum"] == 10
    assert negative["preparation_aware_order"]["declared_progress"] == 7
    report = {"schema": "lhos.blog-declared-examples.v1", "provider_calls": 0,
              "measurement_kind": "constructed_declared_units_not_agent_reward",
              "planner_sha256": hashlib.sha256(Path(implementation.__file__).read_bytes()).hexdigest(), "cases": results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"passed": True, "cases": len(results), "provider_calls": 0}))


if __name__ == "__main__":
    main()
