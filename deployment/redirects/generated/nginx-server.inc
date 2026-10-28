# Include inside the canonical domain server {} before application routing.
if ($sinor_legacy_target != "") { return 301 https://sinor.co.kr$sinor_legacy_target; }
