DO $$
DECLARE
  v_owner uuid := 'feb6d26c-f887-4acb-8e90-2ba0bc2d43b8';
  v_org uuid;
BEGIN
  SELECT o.id INTO v_org
  FROM public.organizations o
  JOIN public.organization_roles r ON r.organization_id = o.id AND r.role = 'agency'
  LIMIT 1;

  IF v_org IS NULL THEN
    INSERT INTO public.organizations (user_id, legal_name, trade_name, status)
    VALUES (v_owner, 'ViaE Travel', 'ViaE Travel', 'active')
    RETURNING id INTO v_org;

    INSERT INTO public.organization_roles (organization_id, role)
    VALUES (v_org, 'agency');
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_org, v_owner, 'organization_owner', 'active')
  ON CONFLICT DO NOTHING;

  -- Quitar membresías ambiguas del titular en organizaciones proveedoras
  DELETE FROM public.organization_members m
  WHERE m.user_id = v_owner
    AND m.organization_id <> v_org;

  UPDATE public.opportunities SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.quotations SET organization_id = v_org WHERE organization_id IS NULL;
  UPDATE public.bookings SET organization_id = v_org WHERE organization_id IS NULL;
END $$;

ALTER TABLE public.opportunities ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.quotations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN organization_id SET NOT NULL;