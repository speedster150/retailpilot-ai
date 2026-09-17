create or replace function public.complete_goods_receipt(p_goods_receipt_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  receipt_row public.goods_receipts%rowtype;
  role_name text;
  item_count integer;
  valid_item_count integer;
  movement_count integer;
begin
  select gr.*
  into receipt_row
  from public.goods_receipts gr
  where gr.id = p_goods_receipt_id
  for update;

  if not found then
    raise exception 'Goods receipt was not found or is not accessible.';
  end if;

  role_name := public.get_user_role(receipt_row.organization_id);

  if role_name is null
     or role_name not in ('admin_owner', 'store_manager', 'inventory_staff') then
    raise exception 'You are not authorized to complete goods receipts.';
  end if;

  if receipt_row.status = 'received' then
    select count(*)
    into movement_count
    from public.inventory_ledger il
    where il.organization_id = receipt_row.organization_id
      and il.reference_type = 'goods_receipt'
      and il.reference_id = receipt_row.id;

    if movement_count > 0 then
      return jsonb_build_object(
        'status', 'already_received',
        'movement_count', movement_count
      );
    end if;

    raise exception 'Goods receipt is marked received but has no inventory movement.';
  end if;

  if receipt_row.status <> 'draft' then
    raise exception 'Only draft goods receipts can be completed.';
  end if;

  if receipt_row.store_id is null
     or not exists (
       select 1
       from public.stores s
       where s.id = receipt_row.store_id
         and s.organization_id = receipt_row.organization_id
     ) then
    raise exception 'The goods receipt store is invalid for its organization.';
  end if;

  if receipt_row.purchase_order_id is null
     or not exists (
       select 1
       from public.purchase_orders po
       where po.id = receipt_row.purchase_order_id
         and po.organization_id = receipt_row.organization_id
         and po.store_id = receipt_row.store_id
     ) then
    raise exception 'The goods receipt purchase order is invalid for its organization or store.';
  end if;

  select count(*)
  into item_count
  from public.goods_receipt_items gri
  where gri.goods_receipt_id = receipt_row.id;

  if item_count = 0 then
    raise exception 'The goods receipt has no receipt items.';
  end if;

  select count(*)
  into valid_item_count
  from public.goods_receipt_items gri
  join public.products p on p.id = gri.product_id
  join public.purchase_order_items poi
    on poi.id = gri.purchase_order_item_id
   and poi.purchase_order_id = receipt_row.purchase_order_id
  where gri.goods_receipt_id = receipt_row.id
    and p.organization_id = receipt_row.organization_id
    and poi.product_id = gri.product_id
    and gri.quantity_received > 0
    and gri.quantity_received <= poi.quantity;

  if valid_item_count <> item_count then
    raise exception 'One or more goods receipt items are invalid or outside the organization.';
  end if;

  select count(*)
  into movement_count
  from public.inventory_ledger il
  where il.organization_id = receipt_row.organization_id
    and il.reference_type = 'goods_receipt'
    and il.reference_id = receipt_row.id;

  if movement_count > 0 then
    raise exception 'This goods receipt already has an inventory movement.';
  end if;

  insert into public.inventory_ledger (
    organization_id,
    product_id,
    store_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    notes
  )
  select
    receipt_row.organization_id,
    gri.product_id,
    receipt_row.store_id,
    'purchase',
    gri.quantity_received,
    'goods_receipt',
    receipt_row.id,
    'Goods receipt ' || coalesce(receipt_row.receipt_number, receipt_row.id::text)
  from public.goods_receipt_items gri
  where gri.goods_receipt_id = receipt_row.id;

  update public.goods_receipts
  set status = 'received'
  where id = receipt_row.id
    and organization_id = receipt_row.organization_id
    and status = 'draft';

  if not found then
    raise exception 'Goods receipt could not be marked received.';
  end if;

  return jsonb_build_object(
    'status', 'received',
    'movement_count', item_count
  );
end;
$function$;

revoke all on function public.complete_goods_receipt(uuid) from public;
grant execute on function public.complete_goods_receipt(uuid) to authenticated;
