from __future__ import annotations

import json
import time
from typing import Any

from jsonschema import Draft202012Validator, RefResolver

from .generated.schema_bundle import LIMITS, SCHEMAS


class ContractValidationError(ValueError):
    pass


def _measure(value: Any, depth: int = 1) -> tuple[int, int]:
    if depth > LIMITS["maxDepth"]:
        raise ContractValidationError("document exceeds maximum depth")
    if isinstance(value, str):
        if len(value) > LIMITS["maxStringLength"]:
            raise ContractValidationError("document contains an oversized string")
        return 1, depth
    if isinstance(value, dict):
        totals = [_measure(item, depth + 1) for item in value.values()]
    elif isinstance(value, list):
        totals = [_measure(item, depth + 1) for item in value]
    else:
        totals = []
    return 1 + sum(item[0] for item in totals), max([depth, *(item[1] for item in totals)])


def validate(
    document: object, schema_path: str = "schemas/workbench/v1/definition.schema.json"
) -> None:
    encoded = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode()
    if len(encoded) > LIMITS["maxBytes"]:
        raise ContractValidationError("document exceeds maximum byte size")
    nodes, _ = _measure(document)
    if nodes > LIMITS["maxNodes"]:
        raise ContractValidationError("document exceeds maximum node count")
    schema = SCHEMAS[schema_path]
    store = {item["$id"]: item for item in SCHEMAS.values()}
    started = time.perf_counter()
    validator = Draft202012Validator(schema, resolver=RefResolver.from_schema(schema, store=store))
    errors = sorted(validator.iter_errors(document), key=lambda error: list(error.absolute_path))
    elapsed_ms = (time.perf_counter() - started) * 1000
    if elapsed_ms > LIMITS["maxValidationMilliseconds"]:
        raise ContractValidationError("validation exceeded execution bound")
    if errors:
        first = errors[0]
        location = ".".join(str(part) for part in first.absolute_path) or "$"
        raise ContractValidationError(f"{location}: {first.message}")
