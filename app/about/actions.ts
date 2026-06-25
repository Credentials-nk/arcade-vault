"use server";

import { Resend } from "resend";

interface ContactPayload {
  name: string;
  email: string;
  msg: string;
}

type ContactResult = { ok: true } | { ok: false; error: string };

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendContactEmail(payload: ContactPayload): Promise<ContactResult> {
  const { name, email, msg } = payload;

  if (!name.trim() || !email.trim() || !msg.trim()) {
    return { ok: false, error: "Todos los campos son obligatorios." };
  }

  try {
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "nikolas090189@gmail.com",
      subject: `[Arcade Vault] Mensaje de ${name}`,
      html: `
        <h2>Nuevo mensaje de contacto — Arcade Vault</h2>
        <p><strong>Nombre:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${msg.replace(/\n/g, "<br/>")}</p>
      `,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al enviar el mensaje.",
    };
  }
}
