/**
 * Meta Cloud API — envío de mensajes WhatsApp por clínica.
 * Cada clínica tiene su propio waPhoneId + waToken.
 */

const GRAPH_VERSION = "v19.0";
const GRAPH_BASE    = `https://graph.facebook.com/${GRAPH_VERSION}`;

export async function sendMetaMessage(
  phoneId: string,
  token: string,
  to: string,
  text: string,
): Promise<void> {
  const url = `${GRAPH_BASE}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Meta] Error enviando mensaje: ${res.status} ${err}`);
  }
}

export async function markMetaMessageRead(
  phoneId: string,
  token: string,
  messageId: string,
): Promise<void> {
  await fetch(`${GRAPH_BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  }).catch(() => {});
}
