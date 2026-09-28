"""
Unit tests for src/hierarchy.py
"""

from src.hierarchy import (
    REGIONS, REGION_MEMBERS, get_parent_child_map, get_all_nodes, get_node_metadata
)


def test_hierarchy_regions():
    """Confirm 5 standard regions exist."""
    assert len(REGIONS) == 5
    assert set(REGIONS) == {"NR", "WR", "SR", "ER", "NER"}


def test_parent_child_mapping():
    """Verify parent-child hierarchy map contains National and Region nodes."""
    pc_map = get_parent_child_map()
    assert "India" in pc_map
    assert set(pc_map["India"]) == {f"India/{r}" for r in REGIONS}

    for region in REGIONS:
        region_id = f"India/{region}"
        assert region_id in pc_map
        assert len(pc_map[region_id]) > len(REGION_MEMBERS[region])  # includes Other_<Region>


def test_node_metadata():
    """Verify level and parent resolution."""
    nat = get_node_metadata("India")
    assert nat["level"] == "national"
    assert nat["parent"] is None

    reg = get_node_metadata("India/NR")
    assert reg["level"] == "region"
    assert reg["parent"] == "India"
    assert reg["region"] == "NR"

    st = get_node_metadata("India/NR/Punjab")
    assert st["level"] == "state"
    assert st["parent"] == "India/NR"
    assert st["region"] == "NR"
