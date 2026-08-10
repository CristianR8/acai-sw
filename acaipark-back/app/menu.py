from fastapi import APIRouter, Depends, HTTPException
from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import db, models, schemas

router = APIRouter(prefix="/menu", tags=["menu"])

def _norm(value: str) -> str:
    return value.strip().lower()

def _format_category(value: str) -> str:
    value = value.strip()
    if not value:
        return value
    return value[:1].upper() + value[1:]

def _format_name(value: str) -> str:
    return value.strip()


def _normalize_ingredients(ingredients):
    if ingredients is None:
        return None
    if not isinstance(ingredients, list):
        return ingredients
    if not ingredients:
        return []
    if isinstance(ingredients[0], str):
        return [str(item).strip() for item in ingredients if str(item).strip()]

    normalized = []
    for item in ingredients:
        data = item.dict() if hasattr(item, "dict") else dict(item)
        clean = {}
        for key, value in data.items():
            if isinstance(value, Decimal):
                clean[key] = float(value)
            else:
                clean[key] = value
        normalized.append(clean)
    return normalized

def _find_duplicate(
    db_session: Session, *, name: str, category: str, exclude_id: int | None = None
):
    query = db_session.query(models.MenuItem).filter(
        func.lower(models.MenuItem.name) == _norm(name),
        func.lower(models.MenuItem.category) == _norm(category),
    )
    if exclude_id is not None:
        query = query.filter(models.MenuItem.id != exclude_id)
    return query.first()


@router.get("/items", response_model=list[schemas.MenuItemOut])
def list_items(db_session: Session = Depends(db.get_db)):
    items = (
        db_session.query(models.MenuItem)
        .filter(models.MenuItem.is_active == True)  # noqa: E712
        .order_by(models.MenuItem.id.desc())
        .all()
    )
    seen: set[tuple[str, str]] = set()
    unique_items: list[models.MenuItem] = []
    for item in items:
        key = (_norm(item.name), _norm(item.category))
        if key in seen:
            continue
        seen.add(key)
        unique_items.append(item)
    return unique_items


@router.get("/items/{item_id}", response_model=schemas.MenuItemOut)
def get_item(item_id: int, db_session: Session = Depends(db.get_db)):
    item = (
        db_session.query(models.MenuItem)
        .filter(models.MenuItem.id == item_id, models.MenuItem.is_active == True)  # noqa: E712
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return item


@router.post("/items", response_model=schemas.MenuItemOut, status_code=201)
def create_item(payload: schemas.MenuItemCreate, db_session: Session = Depends(db.get_db)):
    name = _format_name(payload.name)
    category = _format_category(payload.category)

    existing = _find_duplicate(
        db_session, name=name, category=category, exclude_id=None
    )
    if existing:
        raise HTTPException(status_code=409, detail="El item del menú ya existe")

    item = models.MenuItem(
        name=name,
        category=category,
        price=payload.price,
        description=payload.description,
        ingredients=_normalize_ingredients(payload.ingredients),
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@router.put("/items/{item_id}", response_model=schemas.MenuItemOut)
def update_item(
    item_id: int, payload: schemas.MenuItemUpdate, db_session: Session = Depends(db.get_db)
):
    item = (
        db_session.query(models.MenuItem)
        .filter(models.MenuItem.id == item_id, models.MenuItem.is_active == True)  # noqa: E712
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    data = payload.dict(exclude_unset=True)
    candidate_name = _format_name(data.get("name", item.name))
    candidate_category = _format_category(data.get("category", item.category))
    if candidate_name != item.name or candidate_category != item.category:
        existing = _find_duplicate(
            db_session, name=candidate_name, category=candidate_category, exclude_id=item.id
        )
        if existing:
            raise HTTPException(status_code=409, detail="El item del menú ya existe")

    if "name" in data:
        data["name"] = candidate_name
    if "category" in data:
        data["category"] = candidate_category

    if "ingredients" in data:
        data["ingredients"] = _normalize_ingredients(data["ingredients"])

    for key, value in data.items():
        setattr(item, key, value)

    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db_session: Session = Depends(db.get_db)):
    item = db_session.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    item.is_active = False
    db_session.add(item)
    db_session.commit()
    return None
