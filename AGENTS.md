<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Catalog sharing: products keep a single row owned by `organization_id`; other agencies read it via `visibility` (network = same `organizations.network_id`, public = any active member) and never edit it. Why: avoids duplicate products and ownership conflicts.
- Seller-agency commission is recorded only in the quotation item's catalog snapshot (owner org, pct, amounts); the selling agency is the quotation's organization. Why: no inter-agency settlement engine yet.
- Packages (`package_templates` + `package_template_items`) are org-scoped templates of Catalog product references; applying one copies current Catalog data into normal quotation items, and `quotations.package_template_id` is only a historical reference. Why: quotations must stay independent of later package edits and never duplicate products.
- Accommodation availability: units = product_variants, calendar on = active calendar product_availability_profile, iCal = availability_sources(configuration.kind='ical'), blocks in product_availability_blocks (end_date exclusive); selector reads only the product_availability_status RPC. Why: reuse existing engine tables and hide block details/URLs from other agencies.
