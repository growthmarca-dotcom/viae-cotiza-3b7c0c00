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
