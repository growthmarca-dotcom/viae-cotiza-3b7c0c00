import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

export interface SmartQuoteAcceptedProps {
  organizationName?: string;
  quoteTitle?: string;
  quoteReference?: string;
  clientName?: string | null;
  totalLabel?: string | null;
  acceptedAt?: string;
  bookingReference?: string | null;
  internalUrl?: string;
}

const styles = {
  body: { backgroundColor: "#F7F5F1", fontFamily: "Helvetica, Arial, sans-serif", margin: 0 },
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    margin: "24px auto",
    maxWidth: "560px",
    padding: "32px",
  },
  heading: { color: "#1F4636", fontSize: "22px", margin: "0 0 8px" },
  muted: { color: "#6B6B6B", fontSize: "13px", margin: "0 0 20px" },
  row: { color: "#2A2A2A", fontSize: "15px", margin: "0 0 6px" },
  label: { color: "#8A8A8A" },
  cta: { color: "#1F4636", fontSize: "15px", fontWeight: 600 as const },
};

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-AR");
}

export function SmartQuoteAccepted({
  organizationName = "Agencia",
  quoteTitle = "Propuesta",
  quoteReference = "",
  clientName = null,
  totalLabel = null,
  acceptedAt = "",
  bookingReference = null,
  internalUrl = "https://sales.viaetravel.com",
}: SmartQuoteAcceptedProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{`Propuesta aceptada — ${quoteTitle}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Propuesta aceptada</Heading>
          <Text style={styles.muted}>{organizationName}</Text>

          <Section>
            <Text style={styles.row}>
              <span style={styles.label}>Propuesta: </span>
              {quoteTitle}
            </Text>
            {clientName ? (
              <Text style={styles.row}>
                <span style={styles.label}>Cliente: </span>
                {clientName}
              </Text>
            ) : null}
            {totalLabel ? (
              <Text style={styles.row}>
                <span style={styles.label}>Total: </span>
                {totalLabel}
              </Text>
            ) : null}
            {acceptedAt ? (
              <Text style={styles.row}>
                <span style={styles.label}>Aceptada el: </span>
                {fmtDate(acceptedAt)}
              </Text>
            ) : null}
            {bookingReference ? (
              <Text style={styles.row}>
                <span style={styles.label}>Reserva: </span>
                {bookingReference}
              </Text>
            ) : null}
            {quoteReference ? (
              <Text style={styles.row}>
                <span style={styles.label}>Referencia: </span>
                {quoteReference}
              </Text>
            ) : null}
          </Section>

          <Hr />
          <Text style={styles.cta}>
            <Link href={internalUrl} style={styles.cta}>
              Abrir la propuesta en ViaE Sales Hub
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: SmartQuoteAccepted,
  displayName: "Propuesta aceptada (aviso interno)",
  subject: (data: Record<string, any>) =>
    `Propuesta aceptada — ${data["quoteTitle"] ?? "Propuesta"}`,
  previewData: {
    organizationName: "ViaE Travel",
    quoteTitle: "Bariloche 5 noches",
    quoteReference: "b1f2c3d4",
    clientName: "María González",
    totalLabel: "USD 2.450,00",
    acceptedAt: new Date().toISOString(),
    bookingReference: "VIA-26-000012",
    internalUrl: "https://sales.viaetravel.com",
  },
} satisfies TemplateEntry;
