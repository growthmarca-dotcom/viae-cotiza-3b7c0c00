import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

export interface OrganizationInvitationProps {
  inviterName?: string;
  organizationName?: string;
  networkName?: string | null;
  roleLabel?: string;
  acceptUrl?: string;
  expiresLabel?: string;
}

const Email = ({
  inviterName = "Un integrante de ViaE",
  organizationName = "una agencia",
  networkName,
  roleLabel,
  acceptUrl = "https://sales.viaetravel.com",
  expiresLabel,
}: OrganizationInvitationProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{`${inviterName} te invitó a sumarte a ${organizationName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Te invitaron a ViaE Sales Hub</Heading>
        <Text style={text}>
          <strong>{inviterName}</strong> te invitó a sumarte a la agencia <strong>{organizationName}</strong>
          {networkName ? (
            <>
              {" "}de la red <strong>{networkName}</strong>
            </>
          ) : null}
          {roleLabel ? ` con el rol ${roleLabel}` : ""}.
        </Text>
        <Text style={text}>
          Para aceptar, hacé clic en el botón. Si ya tenés cuenta, ingresá con este mismo email; si no,
          vas a poder crearla con este email y después aceptar la invitación.
        </Text>
        <Button style={button} href={acceptUrl}>
          Aceptar invitación
        </Button>
        <Text style={footer}>
          {expiresLabel ? `La invitación vence el ${expiresLabel}. ` : ""}
          El enlace es personal: solo funciona con la cuenta de este email. Si no esperabas esta
          invitación, podés ignorar este correo.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Invitación para sumarte a ${String(d.organizationName ?? "una agencia")} en ViaE`,
  displayName: "Invitación a agencia",
  previewData: {
    inviterName: "Marcela Carrillo",
    organizationName: "ViaE Travel",
    networkName: "Red Patagonia",
    roleLabel: "Agente",
    acceptUrl: "https://sales.viaetravel.com/invitacion/ejemplo",
    expiresLabel: "08/10/2026",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px 25px", borderTop: "4px solid #C9A227" };
const h1 = { fontSize: "22px", fontWeight: "bold" as const, color: "#1C3F33", margin: "0 0 20px" };
const text = { fontSize: "14px", color: "#55575d", lineHeight: "1.5", margin: "0 0 20px" };
const button = {
  backgroundColor: "#1C3F33",
  color: "#ffffff",
  fontSize: "14px",
  borderRadius: "8px",
  padding: "12px 20px",
  textDecoration: "none",
};
const footer = { fontSize: "12px", color: "#999999", margin: "30px 0 0" };
