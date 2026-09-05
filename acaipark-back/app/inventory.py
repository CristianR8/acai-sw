from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session, joinedload

from . import db, models, schemas

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _norm(value: str) -> str:
    return value.strip().lower()


def _get_product(db_session: Session, product_id: int) -> models.InventoryProduct:
    product = (
        db_session.query(models.InventoryProduct)
        .filter(models.InventoryProduct.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


def _find_product_by_name(
    db_session: Session, *, name: str, exclude_id: int | None = None
) -> models.InventoryProduct | None:
    query = db_session.query(models.InventoryProduct).filter(
        func.lower(models.InventoryProduct.name) == _norm(name)
    )
    if exclude_id is not None:
        query = query.filter(models.InventoryProduct.id != exclude_id)
    return query.first()


def _find_product_by_sku(
    db_session: Session, *, sku: str, exclude_id: int | None = None
) -> models.InventoryProduct | None:
    query = db_session.query(models.InventoryProduct).filter(
        func.lower(models.InventoryProduct.sku) == _norm(sku)
    )
    if exclude_id is not None:
        query = query.filter(models.InventoryProduct.id != exclude_id)
    return query.first()


def _as_decimal(value: Decimal | int | str) -> Decimal:
    if isinstance(value, Decimal):
        return value

    raw = str(value).strip()
    if not raw:
        return Decimal("0")

    raw = raw.replace(" ", "")

    def _looks_like_thousands_sep(s: str, sep: str) -> bool:
        parts = s.split(sep)
        if len(parts) <= 1:
            return False
        if not all(part.isdigit() for part in parts):
            return False
        return len(parts[0]) in (1, 2, 3) and all(len(part) == 3 for part in parts[1:])

    if "." in raw and "," in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "." in raw:
        if _looks_like_thousands_sep(raw, "."):
            raw = raw.replace(".", "")
    elif "," in raw:
        if _looks_like_thousands_sep(raw, ","):
            raw = raw.replace(",", "")
        else:
            raw = raw.replace(",", ".")

    return Decimal(raw)


@router.get("/products", response_model=list[schemas.InventoryProductOut])
def list_products(
    active: bool | None = True,
    kind: schemas.InventoryProductKind | None = None,
    purchased_only: bool = False,
    db_session: Session = Depends(db.get_db),
):
    query = db_session.query(models.InventoryProduct)
    if active is not None:
        query = query.filter(models.InventoryProduct.is_active == active)
    if kind is not None:
        query = query.filter(models.InventoryProduct.kind == kind.value)
    if purchased_only:
        query = query.filter(models.InventoryProduct.is_purchase_registered == True)  # noqa: E712
    return query.order_by(models.InventoryProduct.name.asc()).all()


@router.post("/products", response_model=schemas.InventoryProductOut, status_code=201)
def create_product(
    payload: schemas.InventoryProductCreate, db_session: Session = Depends(db.get_db)
):
    name = payload.name.strip()
    existing = _find_product_by_name(db_session, name=name)

    sku = payload.sku.strip() if payload.sku else None
    if sku and _find_product_by_sku(db_session, sku=sku, exclude_id=existing.id if existing else None):
        raise HTTPException(status_code=409, detail="Ya existe un producto con ese SKU")

    kind = payload.kind.value
    unit = payload.unit.strip() if payload.unit else None
    if kind == schemas.InventoryProductKind.ingredient.value and not unit:
        raise HTTPException(status_code=400, detail="La unidad es requerida para Comidas")

    qty = _as_decimal(payload.initial_quantity)
    total_cost = _as_decimal(payload.total_cost)
    unit_cost = (total_cost / qty) if qty > 0 else Decimal("0")

    if existing and existing.is_active:
        raise HTTPException(status_code=409, detail="Ya existe un producto con ese nombre")

    product = existing or models.InventoryProduct(name=name)
    product.name = name
    product.sku = sku
    product.kind = kind
    product.unit = unit
    product.category = payload.category.strip() if payload.category else None
    product.presentation = payload.presentation.strip() if payload.presentation else None
    product.grams_per_ice_cream = payload.grams_per_ice_cream
    product.topping_cost = payload.topping_cost
    from .inventory_costs import reference_cost
    product.cost = payload.cost if payload.cost is not None else reference_cost(name, payload.category)
    product.supplier_id = payload.supplier_id
    product.is_active = payload.is_active
    product.on_hand = qty
    product.average_cost = unit_cost
    product.last_cost = unit_cost

    db_session.add(product)
    db_session.flush()

    movement = models.StockMovement(
        product_id=product.id,
        movement_type="in",
        quantity=qty,
        unit_cost=unit_cost,
        reason="initial",
        reference_type="manual",
        reference_id=None,
    )
    db_session.add(movement)
    db_session.commit()
    db_session.refresh(product)
    return product


@router.get("/products/{product_id}", response_model=schemas.InventoryProductOut)
def get_product(product_id: int, db_session: Session = Depends(db.get_db)):
    return _get_product(db_session, product_id)


@router.put("/products/{product_id}", response_model=schemas.InventoryProductOut)
def update_product(
    product_id: int,
    payload: schemas.InventoryProductUpdate,
    db_session: Session = Depends(db.get_db),
):
    product = _get_product(db_session, product_id)
    data = payload.dict(exclude_unset=True)

    if "name" in data and data["name"] is not None:
        candidate = data["name"].strip()
        existing = _find_product_by_name(db_session, name=candidate, exclude_id=product.id)
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe un producto con ese nombre")
        data["name"] = candidate

    if "sku" in data and data["sku"] is not None:
        candidate = data["sku"].strip() or None
        if candidate:
            existing = _find_product_by_sku(db_session, sku=candidate, exclude_id=product.id)
            if existing:
                raise HTTPException(status_code=409, detail="Ya existe un producto con ese SKU")
        data["sku"] = candidate

    if "unit" in data and data["unit"] is not None:
        data["unit"] = data["unit"].strip() or None

    if "kind" in data and data["kind"] is not None:
        data["kind"] = data["kind"].value

    if ("on_hand" in data) != ("total_cost" in data):
        raise HTTPException(
            status_code=400,
            detail="Para ajustar stock/costo debes enviar `on_hand` y `total_cost` juntos",
        )

    pending_stock_adjust = None
    if "on_hand" in data and "total_cost" in data:
        new_on_hand = _as_decimal(data.pop("on_hand"))
        total_cost = _as_decimal(data.pop("total_cost"))
        if new_on_hand < 0:
            raise HTTPException(status_code=400, detail="Stock inválido")
        unit_cost = (total_cost / new_on_hand) if new_on_hand > 0 else Decimal("0")
        pending_stock_adjust = (new_on_hand, unit_cost)

    for key, value in data.items():
        setattr(product, key, value)

    if product.kind == schemas.InventoryProductKind.ingredient.value and not product.unit:
        raise HTTPException(status_code=400, detail="La unidad es requerida para Comidas")

    if pending_stock_adjust is not None:
        new_on_hand, unit_cost = pending_stock_adjust
        old_on_hand = _as_decimal(product.on_hand)
        delta = new_on_hand - old_on_hand
        product.on_hand = new_on_hand
        product.average_cost = unit_cost
        product.last_cost = unit_cost
        movement = models.StockMovement(
            product_id=product.id,
            movement_type="adjust",
            quantity=delta,
            unit_cost=unit_cost,
            reason="manual edit",
            reference_type="manual",
            reference_id=None,
        )
        db_session.add(movement)

    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: int, db_session: Session = Depends(db.get_db)):
    product = _get_product(db_session, product_id)

    has_relations = (
        db_session.query(models.StockMovement.id)
        .filter(models.StockMovement.product_id == product.id)
        .limit(1)
        .first()
        is not None
        or db_session.query(models.PurchaseItem.id)
        .filter(models.PurchaseItem.product_id == product.id)
        .limit(1)
        .first()
        is not None
        or db_session.query(models.RecipeItem.id)
        .filter(models.RecipeItem.product_id == product.id)
        .limit(1)
        .first()
        is not None
    )

    if has_relations:
        product.is_active = False
        db_session.add(product)
        db_session.commit()
        return None

    db_session.delete(product)
    db_session.commit()
    return None


@router.get("/low-stock", response_model=list[schemas.InventoryProductOut])
def low_stock(db_session: Session = Depends(db.get_db)):
    raise HTTPException(status_code=410, detail="Funcionalidad eliminada (campo mínimo removido)")


@router.post("/movements", response_model=schemas.StockMovementOut, status_code=201)
def create_movement(
    payload: schemas.StockMovementCreate, db_session: Session = Depends(db.get_db)
):
    product = _get_product(db_session, payload.product_id)
    mtype = payload.movement_type.value
    qty = _as_decimal(payload.quantity)

    if mtype == "in":
        delta = qty
        next_on_hand = _as_decimal(product.on_hand) + delta
    elif mtype == "out":
        delta = -qty
        next_on_hand = _as_decimal(product.on_hand) + delta
        if next_on_hand < 0:
            raise HTTPException(status_code=409, detail="Stock insuficiente")
    elif mtype == "adjust":
        next_on_hand = qty
        delta = next_on_hand - _as_decimal(product.on_hand)
    else:
        raise HTTPException(status_code=400, detail="Tipo de movimiento inválido")

    movement = models.StockMovement(
        product_id=product.id,
        movement_type=mtype,
        quantity=delta,
        unit_cost=payload.unit_cost,
        reason=payload.reason,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
    )
    product.on_hand = next_on_hand

    db_session.add(movement)
    db_session.add(product)
    db_session.commit()
    db_session.refresh(movement)
    return movement


@router.get("/movements", response_model=list[schemas.StockMovementOut])
def list_movements(
    product_id: int | None = None,
    reference_type: str | None = None,
    db_session: Session = Depends(db.get_db),
):
    query = db_session.query(models.StockMovement)
    if product_id is not None:
        query = query.filter(models.StockMovement.product_id == product_id)
    if reference_type is not None:
        query = query.filter(models.StockMovement.reference_type == reference_type)
    return query.order_by(models.StockMovement.id.desc()).limit(500).all()


@router.post("/suppliers", response_model=schemas.SupplierOut, status_code=201)
def create_supplier(
    payload: schemas.SupplierCreate, db_session: Session = Depends(db.get_db)
):
    existing = (
        db_session.query(models.Supplier)
        .filter(func.lower(models.Supplier.name) == _norm(payload.name))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Proveedor ya existe")

    supplier = models.Supplier(
        name=payload.name.strip(),
        phone=payload.phone,
        is_active=payload.is_active,
    )
    db_session.add(supplier)
    db_session.commit()
    db_session.refresh(supplier)
    return supplier


@router.get("/suppliers", response_model=list[schemas.SupplierOut])
def list_suppliers(active: bool | None = True, db_session: Session = Depends(db.get_db)):
    query = db_session.query(models.Supplier)
    if active is not None:
        query = query.filter(models.Supplier.is_active == active)
    return query.order_by(models.Supplier.name.asc()).all()


@router.put("/suppliers/{supplier_id}", response_model=schemas.SupplierOut)
def update_supplier(
    supplier_id: int,
    payload: schemas.SupplierUpdate,
    db_session: Session = Depends(db.get_db),
):
    supplier = (
        db_session.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    data = payload.dict(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        candidate = data["name"].strip()
        existing = (
            db_session.query(models.Supplier)
            .filter(
                func.lower(models.Supplier.name) == _norm(candidate),
                models.Supplier.id != supplier.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Proveedor ya existe")
        data["name"] = candidate

    for key, value in data.items():
        setattr(supplier, key, value)

    db_session.add(supplier)
    db_session.commit()
    db_session.refresh(supplier)
    return supplier


@router.post("/purchases", response_model=schemas.PurchaseOut, status_code=201)
def create_purchase(
    payload: schemas.PurchaseCreate, db_session: Session = Depends(db.get_db)
):
    if payload.purchased_at and payload.purchased_at.date() > date.today():
        raise HTTPException(
            status_code=400,
            detail="La fecha de compra no puede ser posterior al día actual",
        )
    def resolve_supplier_id(supplier_id: int | None) -> int | None:
        if supplier_id is None:
            return None
        supplier = (
            db_session.query(models.Supplier)
            .filter(models.Supplier.id == supplier_id, models.Supplier.is_active == True)  # noqa: E712
            .first()
        )
        if not supplier:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")
        return supplier.id

    def resolve_product(item: schemas.PurchaseItemCreate) -> models.InventoryProduct:
        if item.product_id:
            return _get_product(db_session, item.product_id)

        name = (item.product_name or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Producto requerido")

        existing = _find_product_by_name(db_session, name=name)
        if existing:
            if not existing.is_active:
                existing.is_active = True
                db_session.add(existing)
            return existing

        kind = (
            item.product_kind.value
            if item.product_kind is not None
            else schemas.InventoryProductKind.material.value
        )
        unit = item.unit.strip() if item.unit else None
        if kind == schemas.InventoryProductKind.ingredient.value and not unit:
            raise HTTPException(status_code=400, detail="Unidad requerida para ingredientes")

        from .inventory_costs import reference_cost
        product = models.InventoryProduct(name=name, kind=kind, unit=unit, is_active=True, cost=reference_cost(name))
        db_session.add(product)
        db_session.flush()
        return product

    purchase_supplier_id = resolve_supplier_id(payload.supplier_id)
    purchase_date = payload.purchased_at or datetime.utcnow()

    purchase = models.Purchase(
        supplier_id=purchase_supplier_id,
        purchased_at=purchase_date,
        received_at=payload.received_at or datetime.utcnow(),
        total_cost=Decimal("0"),
    )

    total = Decimal("0")
    db_session.add(purchase)
    db_session.flush()  # assign purchase.id

    supplier_ids: set[int] = ({purchase_supplier_id} if purchase_supplier_id else set())

    for item in payload.items:
        product = resolve_product(item)
        # Inventory visible in the new module is sourced exclusively from purchases.
        product.is_purchase_registered = True
        supplier_id = resolve_supplier_id(item.supplier_id)
        if supplier_id is not None:
            supplier_ids.add(supplier_id)
            product.supplier_id = supplier_id
        qty = _as_decimal(item.quantity)
        unit_cost = _as_decimal(item.unit_cost).quantize(Decimal("1"))
        line_total = (qty * unit_cost).quantize(Decimal("1"))
        total += line_total

        purchase_item = models.PurchaseItem(
            purchase_id=purchase.id,
            product_id=product.id,
            supplier_id=supplier_id,
            quantity=qty,
            unit_cost=unit_cost,
            line_total=line_total,
        )
        db_session.add(purchase_item)

        on_hand_before = _as_decimal(product.on_hand)
        on_hand_after = on_hand_before + qty
        if on_hand_after > 0:
            avg_before = _as_decimal(product.average_cost)
            value_before = avg_before * on_hand_before
            value_after = value_before + (unit_cost * qty)
            product.average_cost = value_after / on_hand_after
        product.last_cost = unit_cost
        product.on_hand = on_hand_after

        movement = models.StockMovement(
            product_id=product.id,
            movement_type="in",
            quantity=qty,
            unit_cost=unit_cost,
            reason="purchase",
            reference_type="purchase",
            reference_id=purchase.id,
        )
        db_session.add(movement)
        db_session.add(product)

    purchase.total_cost = total.quantize(Decimal("1"))
    if supplier_ids:
        purchase.supplier_id = supplier_ids.pop() if len(supplier_ids) == 1 else None
    db_session.add(purchase)
    db_session.commit()
    db_session.refresh(purchase)
    return purchase


@router.get("/purchases", response_model=list[schemas.PurchaseOut])
def list_purchases(
    history: str = Query(default="recent", pattern="^(recent|all)$"),
    search: str | None = Query(default=None, max_length=200),
    db_session: Session = Depends(db.get_db),
):
    query = (
        db_session.query(models.Purchase)
        .options(
            joinedload(models.Purchase.supplier),
            joinedload(models.Purchase.items).joinedload(models.PurchaseItem.product),
            joinedload(models.Purchase.items).joinedload(models.PurchaseItem.supplier),
        )
    )
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = (
            query.outerjoin(models.Purchase.supplier)
            .outerjoin(models.Purchase.items)
            .outerjoin(models.PurchaseItem.product)
            .filter(
                or_(
                    func.lower(models.Supplier.name).like(term),
                    func.lower(models.InventoryProduct.name).like(term),
                    cast(models.Purchase.id, String).like(term),
                )
            )
            .distinct()
        )
    query = query.order_by(models.Purchase.purchased_at.desc(), models.Purchase.id.desc())
    return query.all() if history == "all" else query.limit(10).all()


@router.get("/recipes/{menu_item_id}", response_model=schemas.RecipeOut)
def get_recipe(menu_item_id: int, db_session: Session = Depends(db.get_db)):
    recipe = db_session.query(models.Recipe).filter(models.Recipe.menu_item_id == menu_item_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return recipe


@router.get("/recipes", response_model=list[schemas.RecipeCatalogOut])
def list_recipes(db_session: Session = Depends(db.get_db)):
    rows = (
        db_session.query(models.Recipe, models.MenuItem)
        .join(models.MenuItem, models.MenuItem.id == models.Recipe.menu_item_id)
        .options(joinedload(models.Recipe.items).joinedload(models.RecipeItem.product))
        .order_by(models.Recipe.id.desc())
        .all()
    )
    response: list[schemas.RecipeCatalogOut] = []
    for recipe, menu_item in rows:
        ingredients: list[schemas.RecipeIngredientOut] = []
        if isinstance(menu_item.ingredients, list):
            for raw in menu_item.ingredients:
                if not isinstance(raw, dict):
                    continue
                name = str(raw.get("name", "")).strip()
                unit = raw.get("unit")
                quantity = raw.get("quantity", 0)
                if not name:
                    continue
                ingredients.append(
                    schemas.RecipeIngredientOut(
                        name=name,
                        unit=str(unit) if unit is not None else None,
                        quantity=quantity,
                    )
                )
        if not ingredients:
            ingredients = [
                schemas.RecipeIngredientOut(
                    name=item.product.name,
                    unit=item.product.unit,
                    quantity=item.quantity,
                )
                for item in recipe.items
                if item.product is not None
            ]
        response.append(
            schemas.RecipeCatalogOut(
                id=recipe.id,
                menu_item_id=menu_item.id,
                name=menu_item.name,
                yield_quantity=recipe.yield_quantity,
                unit=recipe.unit,
                created_at=recipe.created_at,
                ingredients=ingredients,
            )
        )
    return response


@router.post("/recipes", response_model=schemas.RecipeCatalogOut, status_code=201)
def create_recipe(payload: schemas.RecipeCreate, db_session: Session = Depends(db.get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nombre es requerido")

    existing_menu_item = (
        db_session.query(models.MenuItem)
        .filter(
            func.lower(models.MenuItem.name) == name.lower(),
            func.lower(models.MenuItem.category) == "recetas",
        )
        .first()
    )
    if existing_menu_item:
        existing_recipe = (
            db_session.query(models.Recipe)
            .filter(models.Recipe.menu_item_id == existing_menu_item.id)
            .first()
        )
        if existing_recipe:
            raise HTTPException(status_code=409, detail="La receta ya existe")

    normalized_ingredients: list[dict[str, object]] = []
    for ingredient in payload.ingredients:
        item_name = ingredient.name.strip()
        if not item_name:
            raise HTTPException(status_code=400, detail="Ingrediente inválido")
        unit = ingredient.unit.strip().upper() if ingredient.unit else None
        if unit and unit not in {"ML", "GR", "UND"}:
            raise HTTPException(status_code=400, detail="Unidad inválida (ML, GR, UND)")
        normalized_ingredients.append(
            {
                "name": item_name,
                "unit": unit,
                "quantity": str(ingredient.quantity),
            }
        )

    if existing_menu_item:
        menu_item = existing_menu_item
        menu_item.name = name
        menu_item.category = "Recetas"
        menu_item.price = 0
        menu_item.description = None
        menu_item.ingredients = normalized_ingredients
        menu_item.is_active = False
        db_session.add(menu_item)
        db_session.flush()
    else:
        menu_item = models.MenuItem(
            name=name,
            category="Recetas",
            price=0,
            description=None,
            ingredients=normalized_ingredients,
            is_active=False,
        )
        db_session.add(menu_item)
        db_session.flush()

    recipe = models.Recipe(
        menu_item_id=menu_item.id,
        yield_quantity=payload.yield_quantity,
        unit=payload.unit.strip().upper() if payload.unit else None,
        notes=payload.notes,
    )
    db_session.add(recipe)
    db_session.commit()
    db_session.refresh(recipe)

    return schemas.RecipeCatalogOut(
        id=recipe.id,
        menu_item_id=menu_item.id,
        name=menu_item.name,
        yield_quantity=recipe.yield_quantity,
        unit=recipe.unit,
        created_at=recipe.created_at,
        ingredients=[
            schemas.RecipeIngredientOut(
                name=item["name"],
                unit=item["unit"],
                quantity=item["quantity"],
            )
            for item in normalized_ingredients
        ],
    )


@router.put("/recipes/{recipe_id}", response_model=schemas.RecipeCatalogOut)
def update_recipe(
    recipe_id: int, payload: schemas.RecipeCreate, db_session: Session = Depends(db.get_db)
):
    recipe = db_session.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")

    menu_item = (
        db_session.query(models.MenuItem)
        .filter(models.MenuItem.id == recipe.menu_item_id)
        .first()
    )
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item no encontrado")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nombre es requerido")

    existing = (
        db_session.query(models.MenuItem)
        .filter(
            func.lower(models.MenuItem.name) == name.lower(),
            func.lower(models.MenuItem.category) == "recetas",
            models.MenuItem.id != menu_item.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="La receta ya existe")

    normalized_ingredients: list[dict[str, object]] = []
    for ingredient in payload.ingredients:
        item_name = ingredient.name.strip()
        if not item_name:
            raise HTTPException(status_code=400, detail="Ingrediente inválido")
        unit = ingredient.unit.strip().upper() if ingredient.unit else None
        if unit and unit not in {"ML", "GR", "UND"}:
            raise HTTPException(status_code=400, detail="Unidad inválida (ML, GR, UND)")
        normalized_ingredients.append(
            {
                "name": item_name,
                "unit": unit,
                "quantity": str(ingredient.quantity),
            }
        )

    menu_item.name = name
    menu_item.ingredients = normalized_ingredients
    recipe.yield_quantity = payload.yield_quantity
    recipe.unit = payload.unit.strip().upper() if payload.unit else None
    recipe.notes = payload.notes

    db_session.add(menu_item)
    db_session.add(recipe)
    db_session.commit()
    db_session.refresh(recipe)

    return schemas.RecipeCatalogOut(
        id=recipe.id,
        menu_item_id=menu_item.id,
        name=menu_item.name,
        yield_quantity=recipe.yield_quantity,
        unit=recipe.unit,
        created_at=recipe.created_at,
        ingredients=[
            schemas.RecipeIngredientOut(
                name=item["name"],
                unit=item["unit"],
                quantity=item["quantity"],
            )
            for item in normalized_ingredients
        ],
    )


@router.delete("/recipes/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: str, db_session: Session = Depends(db.get_db)):
    try:
        recipe_id_int = int(recipe_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Id inválido")

    recipe = (
        db_session.query(models.Recipe).filter(models.Recipe.id == recipe_id_int).first()
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")

    db_session.delete(recipe)
    db_session.commit()
    return None


@router.put("/recipes/{menu_item_id}", response_model=schemas.RecipeOut)
def upsert_recipe(
    menu_item_id: int, payload: schemas.RecipeUpsert, db_session: Session = Depends(db.get_db)
):
    menu_item = db_session.query(models.MenuItem).filter(models.MenuItem.id == menu_item_id).first()
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item no encontrado")

    recipe = db_session.query(models.Recipe).filter(models.Recipe.menu_item_id == menu_item_id).first()
    if not recipe:
        recipe = models.Recipe(menu_item_id=menu_item_id)
        db_session.add(recipe)
        db_session.flush()

    recipe.yield_quantity = payload.yield_quantity
    recipe.notes = payload.notes
    recipe.items = []

    for item in payload.items:
        _get_product(db_session, item.product_id)
        recipe.items.append(
            models.RecipeItem(
                product_id=item.product_id,
                quantity=item.quantity,
                waste_pct=item.waste_pct,
            )
        )

    db_session.add(recipe)
    db_session.commit()
    db_session.refresh(recipe)
    return recipe


@router.post("/consume", response_model=schemas.ConsumeSaleResult)
def consume_sale(payload: schemas.ConsumeSaleRequest, db_session: Session = Depends(db.get_db)):
    recipe = (
        db_session.query(models.Recipe)
        .filter(models.Recipe.menu_item_id == payload.menu_item_id)
        .first()
    )
    if not recipe:
        raise HTTPException(status_code=409, detail="No hay receta configurada para este producto")

    sold_qty = _as_decimal(payload.quantity)
    yield_qty = _as_decimal(recipe.yield_quantity)
    multiplier = sold_qty / yield_qty

    total_cost = Decimal("0")
    movements_created = 0

    for recipe_item in recipe.items:
        product = _get_product(db_session, recipe_item.product_id)
        base_qty = _as_decimal(recipe_item.quantity) * multiplier
        waste = _as_decimal(recipe_item.waste_pct)
        required = base_qty * (Decimal("1") + waste)

        next_on_hand = _as_decimal(product.on_hand) - required
        if next_on_hand < 0:
            raise HTTPException(
                status_code=409,
                detail=f"Stock insuficiente para {product.name}",
            )

        movement = models.StockMovement(
            product_id=product.id,
            movement_type="out",
            quantity=-required,
            unit_cost=product.average_cost,
            reason="sale",
            reference_type="sale",
            reference_id=None,
        )
        product.on_hand = next_on_hand
        db_session.add(movement)
        db_session.add(product)
        movements_created += 1

        total_cost += required * _as_decimal(product.average_cost)

    db_session.commit()
    return schemas.ConsumeSaleResult(
        menu_item_id=payload.menu_item_id,
        quantity=payload.quantity,
        total_cost=total_cost,
        movements_created=movements_created,
    )


@router.post("/bootstrap/from-menu-ingredients")
def bootstrap_products_from_menu_ingredients(db_session: Session = Depends(db.get_db)):
    items = db_session.query(models.MenuItem).all()
    created = 0
    for item in items:
        ingredients = item.ingredients or []
        if not isinstance(ingredients, list):
            continue
        for raw in ingredients:
            if not isinstance(raw, str):
                continue
            name = raw.strip()
            if not name:
                continue
            if _find_product_by_name(db_session, name=name):
                continue
            product = models.InventoryProduct(
                name=name,
                kind="ingredient",
                unit="unit",
                is_active=True,
            )
            db_session.add(product)
            created += 1

    db_session.commit()
    return {"created": created}


def _xlsx_response(filename: str, build_workbook) -> Response:
    try:
        import openpyxl  # type: ignore
    except Exception:
        raise HTTPException(
            status_code=501,
            detail="Exportar a Excel requiere `openpyxl` instalado en el backend",
        )

    wb = openpyxl.Workbook()
    build_workbook(wb)
    out = BytesIO()
    wb.save(out)
    out.seek(0)
    return Response(
        content=out.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/exports/inventory.xlsx")
def export_inventory_xlsx(db_session: Session = Depends(db.get_db)):
    products = (
        db_session.query(models.InventoryProduct)
        .filter(
            models.InventoryProduct.is_active == True,  # noqa: E712
            models.InventoryProduct.is_purchase_registered == True,  # noqa: E712
        )
        .order_by(models.InventoryProduct.name.asc())
        .all()
    )

    def build(wb):
        ws = wb.active
        ws.title = "Inventario"
        ws.append(
            [
                "ID",
                "Nombre",
                "Tipo",
                "Unidad",
                "Stock",
                "Costo",
                "Costo promedio",
                "Último costo",
                "Activo",
                "Creado",
            ]
        )
        for p in products:
            ws.append(
                [
                    p.id,
                    p.name,
                    p.kind,
                    p.unit,
                    float(p.on_hand),
                    float(p.cost) if p.cost is not None else None,
                    float(p.average_cost),
                    float(p.last_cost),
                    bool(p.is_active),
                    p.created_at.isoformat() if p.created_at else None,
                ]
            )

    return _xlsx_response("inventory.xlsx", build)


@router.get("/exports/purchases.xlsx")
def export_purchases_xlsx(
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db_session: Session = Depends(db.get_db),
):
    query = (
        db_session.query(models.Purchase)
        .options(
            joinedload(models.Purchase.supplier),
            joinedload(models.Purchase.items).joinedload(models.PurchaseItem.product),
            joinedload(models.Purchase.items).joinedload(models.PurchaseItem.supplier),
        )
        .order_by(models.Purchase.purchased_at.desc(), models.Purchase.id.desc())
    )
    if from_date:
        query = query.filter(models.Purchase.purchased_at >= from_date)
    if to_date:
        query = query.filter(models.Purchase.purchased_at <= to_date)
    purchases = query.all()

    def build(wb):
        ws = wb.active
        ws.title = "Compras"
        ws.append(["Compra", "Fecha", "Proveedor", "Producto", "Cantidad", "Costo unitario", "Monto gastado"])
        for purchase in purchases:
            purchase_date = purchase.purchased_at or purchase.received_at or purchase.created_at
            for item in purchase.items:
                ws.append([
                    purchase.id,
                    purchase_date.isoformat() if purchase_date else None,
                    item.supplier.name if item.supplier else purchase.supplier_name,
                    item.product_name,
                    float(item.quantity),
                    float(item.unit_cost),
                    float(item.line_total),
                ])

    return _xlsx_response("historial-compras.xlsx", build)
