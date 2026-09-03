-- Las RPC de liquidaciones no deben ser ejecutables por usuarios anónimos.
REVOKE ALL ON FUNCTION public.submit_settlement_invoice(uuid, text, text, text, integer, text, date, numeric, text, text, text, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_settlement_invoice(uuid, text, text, text, integer, text, date, numeric, text, text, text, text, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_settlement_invoice(uuid, text, text, text, integer, text, date, numeric, text, text, text, text, uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.review_settlement_document(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_settlement_document(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_settlement_document(uuid, boolean, text) TO authenticated;

REVOKE ALL ON FUNCTION public.record_commission_settlement_payment(uuid, numeric, text, date, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_commission_settlement_payment(uuid, numeric, text, date, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_commission_settlement_payment(uuid, numeric, text, date, text, text, text, text) TO authenticated;