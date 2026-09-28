"""
hierarchy.py
Defines TerraWatt's 3-level hierarchy:
  State / Bulk Consumer (+ synthetic "Other" node) -> Region (NR/WR/SR/ER/NER) -> National (India)

Single source of truth for hierarchy structure across forecasting, reconciliation,
evaluation, API, and frontend components.
"""

from typing import Dict, List, Tuple
import pandas as pd
from hierarchicalforecast.utils import aggregate

from src.config import STATE_LEVEL_RELIABLE_FROM

KNOWN_BAD_VALUES = {
    ("NER: EnergyMet", "2014-11-25"): "corrupted region total; interpolate",
    ("NR: EnergyMet_state_breakdown", "2020-09-30"): "region total reported without state breakdown",
}

REGION_MEMBERS = {
    "NR": [
        "Punjab: EnergyMet", "Haryana: EnergyMet", "Rajasthan: EnergyMet",
        "Delhi: EnergyMet", "UP: EnergyMet", "Uttarakhand: EnergyMet",
        "HP: EnergyMet", "J&K(UT) & Ladakh(UT): EnergyMet", "Chandigarh: EnergyMet",
        "Railways_NR ISTS: EnergyMet", "Bulk Consumer_NR ISTS: EnergyMet",
    ],
    "WR": [
        "Chhattisgarh: EnergyMet", "Gujarat: EnergyMet", "MP: EnergyMet",
        "Maharashtra: EnergyMet", "Goa: EnergyMet",
        "AMNSIL: EnergyMet", "DNHDDPDCL: EnergyMet",
        "BALCO: EnergyMet", "RIL JAMNAGAR: EnergyMet",
    ],
    "SR": [
        "Andhra Pradesh: EnergyMet", "Karnataka: EnergyMet", "Kerala: EnergyMet",
        "Tamil Nadu: EnergyMet", "Puducherry: EnergyMet", "Telangana: EnergyMet",
    ],
    "ER": [
        "Bihar: EnergyMet", "DVC: EnergyMet", "Jharkhand: EnergyMet",
        "Odisha: EnergyMet", "West Bengal: EnergyMet", "Sikkim: EnergyMet",
        "Railways_ER ISTS: EnergyMet",
    ],
    "NER": [
        "Arunachal Pradesh: EnergyMet", "Assam: EnergyMet", "Manipur: EnergyMet",
        "Meghalaya: EnergyMet", "Mizoram: EnergyMet", "Nagaland: EnergyMet",
        "Tripura: EnergyMet",
    ],
}

REGIONS = ["NR", "WR", "SR", "ER", "NER"]


def get_parent_child_map() -> Dict[str, List[str]]:
    """Returns parent node ID -> list of child node IDs."""
    mapping = {
        "India": [f"India/{r}" for r in REGIONS]
    }
    for region, members in REGION_MEMBERS.items():
        region_id = f"India/{region}"
        children = [f"India/{region}/{m.replace(': EnergyMet', '')}" for m in members]
        children.append(f"India/{region}/Other_{region}")
        mapping[region_id] = children
    return mapping


def get_all_nodes() -> List[str]:
    """Returns a flat list of all unique node IDs across the hierarchy."""
    nodes = ["India"]
    for region, children in get_parent_child_map().items():
        if region != "India" and region not in nodes:
            nodes.append(region)
        for child in children:
            if child not in nodes:
                nodes.append(child)
    return nodes


def get_node_metadata(node_id: str) -> Dict[str, str]:
    """Returns metadata for a given node_id (level, region, parent)."""
    parts = node_id.split("/")
    if len(parts) == 1:
        return {"node_id": node_id, "level": "national", "region": None, "parent": None}
    elif len(parts) == 2:
        return {"node_id": node_id, "level": "region", "region": parts[1], "parent": parts[0]}
    else:
        return {"node_id": node_id, "level": "state", "region": parts[1], "parent": f"{parts[0]}/{parts[1]}"}


def build_summing_matrix(df_clean: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, dict]:
    """
    Build the full 3-level summing matrix S using hierarchicalforecast.aggregate().
    Adds synthetic 'Other_<Region>' nodes to ensure exact mathematical sum coherence.
    """
    long_rows = []
    for region in REGIONS:
        member_cols = REGION_MEMBERS[region]
        region_col = f"{region}: EnergyMet"

        for col in member_cols:
            node_name = col.replace(": EnergyMet", "")
            temp = df_clean[["date", col]].copy()
            temp.columns = ["ds", "y"]
            temp["Country"] = "India"
            temp["Region"] = region
            temp["State"] = node_name
            long_rows.append(temp)

        # Synthetic residual node for unassigned regional demand
        other = df_clean[region_col] - df_clean[member_cols].sum(axis=1)
        temp_other = pd.DataFrame({
            "ds": df_clean["date"],
            "y": other,
            "Country": "India",
            "Region": region,
            "State": f"Other_{region}"
        })
        long_rows.append(temp_other)

    long_df = pd.concat(long_rows, ignore_index=True)
    long_df = long_df.dropna(subset=["y"])

    spec = [["Country"], ["Country", "Region"], ["Country", "Region", "State"]]
    Y_df, S_df, tags = aggregate(df=long_df, spec=spec)
    return Y_df, S_df, tags
