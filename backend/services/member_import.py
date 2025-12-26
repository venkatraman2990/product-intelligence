"""Member import service - imports members and GWP data from Excel."""

import pandas as pd
from decimal import Decimal
from sqlalchemy.orm import Session
from typing import Tuple, Dict

from backend.models.member import (
    Member,
    LineOfBusiness,
    ClassOfBusiness,
    Product,
    SubProduct,
    MemberProductProgram,
    GWPBreakdown,
)


def get_or_create_dimension(
    db: Session,
    model_class,
    id_field: str,
    id_value: str,
    name: str,
) -> str:
    """Get existing dimension record or create new one. Returns the UUID."""
    # Check if exists
    existing = db.query(model_class).filter(
        getattr(model_class, id_field) == id_value
    ).first()

    if existing:
        return existing.id

    # Create new
    new_record = model_class(**{id_field: id_value, "name": name})
    db.add(new_record)
    db.flush()  # Get the ID without committing
    return new_record.id


def import_from_excel(db: Session, file_path: str) -> Dict:
    """
    Import members and GWP data from Excel file.

    Expected sheets:
    - 'Member master': MEMBER_MASTER_NAME, MEMBER_ID
    - 'GWP Breakdown': Full hierarchy with GWP amounts

    Returns dict with import statistics.
    """
    # Read Excel file
    xl = pd.ExcelFile(file_path)

    # Import Members
    member_df = pd.read_excel(xl, 'Member master')
    members_imported = 0
    member_uuid_map = {}  # member_id -> UUID

    for _, row in member_df.iterrows():
        member_id = row['MEMBER_ID']
        name = row['MEMBER_MASTER_NAME']

        # Check if exists
        existing = db.query(Member).filter(Member.member_id == member_id).first()
        if existing:
            member_uuid_map[member_id] = existing.id
        else:
            member = Member(member_id=member_id, name=name)
            db.add(member)
            db.flush()
            member_uuid_map[member_id] = member.id
            members_imported += 1

    # Import GWP Breakdown
    gwp_df = pd.read_excel(xl, 'GWP Breakdown')
    gwp_rows_imported = 0

    # Track dimension counts
    lob_ids = set()
    cob_ids = set()
    product_ids = set()
    sub_product_ids = set()
    mpp_ids = set()

    for _, row in gwp_df.iterrows():
        member_id = row['MEMBER_ID']

        # Skip if member not found
        if member_id not in member_uuid_map:
            continue

        member_uuid = member_uuid_map[member_id]

        # Get or create dimensions
        lob_uuid = get_or_create_dimension(
            db, LineOfBusiness, 'lob_id',
            row['LINE_OF_BUSINESS_ID'],
            row['LINE_OF_BUSINESS_MASTER_NAME']
        )
        lob_ids.add(row['LINE_OF_BUSINESS_ID'])

        cob_uuid = get_or_create_dimension(
            db, ClassOfBusiness, 'cob_id',
            row['CLASS_OF_BUSINESS_ID'],
            row['CLASS_OF_BUSINESS_MASTER_NAME']
        )
        cob_ids.add(row['CLASS_OF_BUSINESS_ID'])

        product_uuid = get_or_create_dimension(
            db, Product, 'product_id',
            row['PRODUCT_ID'],
            row['PRODUCT_MASTER_NAME']
        )
        product_ids.add(row['PRODUCT_ID'])

        sub_product_uuid = get_or_create_dimension(
            db, SubProduct, 'sub_product_id',
            row['SUB_PRODUCT_ID'],
            row['SUB_PRODUCT_MASTER_NAME']
        )
        sub_product_ids.add(row['SUB_PRODUCT_ID'])

        mpp_uuid = get_or_create_dimension(
            db, MemberProductProgram, 'mpp_id',
            row['MEMBER_PRODUCTS_PROGRAM_ID'],
            row['MEMBER_PRODUCTS_PROGRAM_MASTER_NAME']
        )
        mpp_ids.add(row['MEMBER_PRODUCTS_PROGRAM_ID'])

        # Parse GWP amount
        gwp_value = row['TOTAL_GWP']
        if pd.isna(gwp_value):
            gwp_value = 0
        total_gwp = Decimal(str(gwp_value))

        # Check if GWP breakdown already exists for this exact combination
        existing_gwp = db.query(GWPBreakdown).filter(
            GWPBreakdown.member_id == member_uuid,
            GWPBreakdown.lob_id == lob_uuid,
            GWPBreakdown.cob_id == cob_uuid,
            GWPBreakdown.product_id == product_uuid,
            GWPBreakdown.sub_product_id == sub_product_uuid,
            GWPBreakdown.mpp_id == mpp_uuid,
        ).first()

        if existing_gwp:
            # Update GWP value
            existing_gwp.total_gwp = total_gwp
        else:
            # Create new breakdown
            breakdown = GWPBreakdown(
                member_id=member_uuid,
                lob_id=lob_uuid,
                cob_id=cob_uuid,
                product_id=product_uuid,
                sub_product_id=sub_product_uuid,
                mpp_id=mpp_uuid,
                total_gwp=total_gwp,
            )
            db.add(breakdown)
            gwp_rows_imported += 1

    # Commit all changes
    db.commit()

    return {
        "members_imported": members_imported,
        "gwp_rows_imported": gwp_rows_imported,
        "dimension_counts": {
            "line_of_business": len(lob_ids),
            "class_of_business": len(cob_ids),
            "products": len(product_ids),
            "sub_products": len(sub_product_ids),
            "member_product_programs": len(mpp_ids),
        },
        "message": f"Import completed: {members_imported} members, {gwp_rows_imported} GWP rows",
    }


def get_member_gwp_tree(db: Session, member_uuid: str) -> Dict:
    """
    Build hierarchical GWP tree for a member.

    Returns nested structure: LOB -> COB -> Product -> SubProduct -> MPP
    with aggregated GWP totals at each level.
    """
    from collections import defaultdict
    from decimal import Decimal

    # Get member
    member = db.query(Member).filter(Member.id == member_uuid).first()
    if not member:
        return None

    # Get all GWP breakdowns for this member with joined dimensions
    breakdowns = db.query(GWPBreakdown).filter(
        GWPBreakdown.member_id == member_uuid
    ).all()

    if not breakdowns:
        return {
            "member_id": member.member_id,
            "member_name": member.name,
            "total_gwp": Decimal("0"),
            "tree": [],
        }

    # Build tree structure
    tree = defaultdict(lambda: {
        "children": defaultdict(lambda: {
            "children": defaultdict(lambda: {
                "children": defaultdict(lambda: {
                    "children": defaultdict(lambda: {
                        "gwp": Decimal("0"),
                        "breakdown_ids": [],
                    }),
                    "gwp": Decimal("0"),
                }),
                "gwp": Decimal("0"),
            }),
            "gwp": Decimal("0"),
        }),
        "gwp": Decimal("0"),
    })

    total_gwp = Decimal("0")

    for b in breakdowns:
        lob = b.line_of_business
        cob = b.class_of_business
        prod = b.product
        sub = b.sub_product
        mpp = b.member_product_program
        gwp = b.total_gwp or Decimal("0")

        total_gwp += gwp

        # Build nested structure
        lob_key = (lob.lob_id, lob.name)
        cob_key = (cob.cob_id, cob.name)
        prod_key = (prod.product_id, prod.name)
        sub_key = (sub.sub_product_id, sub.name)
        mpp_key = (mpp.mpp_id, mpp.name)

        tree[lob_key]["gwp"] += gwp
        tree[lob_key]["children"][cob_key]["gwp"] += gwp
        tree[lob_key]["children"][cob_key]["children"][prod_key]["gwp"] += gwp
        tree[lob_key]["children"][cob_key]["children"][prod_key]["children"][sub_key]["gwp"] += gwp
        tree[lob_key]["children"][cob_key]["children"][prod_key]["children"][sub_key]["children"][mpp_key]["gwp"] += gwp
        tree[lob_key]["children"][cob_key]["children"][prod_key]["children"][sub_key]["children"][mpp_key]["breakdown_ids"].append(b.id)

    # Convert to list format
    def build_node(key, data, level):
        code, name = key
        children = []

        if "children" in data and data["children"]:
            child_level = {
                "lob": "cob",
                "cob": "product",
                "product": "sub_product",
                "sub_product": "mpp",
            }.get(level, None)

            if child_level:
                for child_key, child_data in data["children"].items():
                    children.append(build_node(child_key, child_data, child_level))

        node = {
            "id": code,
            "code": code,
            "name": name,
            "level": level,
            "total_gwp": str(data["gwp"]),
            "children": children,
        }

        if "breakdown_ids" in data:
            node["gwp_breakdown_ids"] = data["breakdown_ids"]

        return node

    result_tree = []
    for lob_key, lob_data in tree.items():
        result_tree.append(build_node(lob_key, lob_data, "lob"))

    return {
        "member_id": member.member_id,
        "member_name": member.name,
        "total_gwp": str(total_gwp),
        "tree": result_tree,
    }
