import AfricasTalking from "africastalking";

function getClient() {
  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;
  if (!username || !apiKey) return null;
  const at = AfricasTalking({ username, apiKey });
  return at.SMS;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Ethiopian numbers: 09xxxxxxxx → +2519xxxxxxxx, 07xxxxxxxx → +2517xxxxxxxx
  if (digits.startsWith("0") && digits.length === 10) {
    return `+251${digits.slice(1)}`;
  }
  // Already has country code
  if (digits.startsWith("251") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("+")) return phone.trim();
  return `+${digits}`;
}

async function send(to: string, message: string, logger?: { error: (obj: unknown, msg: string) => void }): Promise<void> {
  const sms = getClient();
  if (!sms) {
    // Credentials not yet configured — log and skip silently
    console.warn("[SMS] AT_USERNAME / AT_API_KEY not set. Skipping SMS.");
    return;
  }
  const formatted = formatPhone(to);
  try {
    await sms.send({ to: [formatted], message });
  } catch (err) {
    if (logger) {
      logger.error({ err, to: formatted }, "Failed to send SMS");
    } else {
      console.error("[SMS] Send failed:", err);
    }
  }
}

export async function sendKebeleVerifiedSms(
  ownerName: string,
  ownerPhone: string,
  propertyAddress: string,
  logger?: { error: (obj: unknown, msg: string) => void },
): Promise<void> {
  const message =
    `Dear ${ownerName}, your property (${propertyAddress}) has been VERIFIED by the Kebele Officer. ` +
    `It is now awaiting final approval from the City Office. - Jimma City Administration`;
  await send(ownerPhone, message, logger);
}

export async function sendCityApprovedSms(
  ownerName: string,
  ownerPhone: string,
  addressCode: string,
  logger?: { error: (obj: unknown, msg: string) => void },
): Promise<void> {
  const message =
    `Dear ${ownerName}, your property has been OFFICIALLY APPROVED by Jimma City Administration. ` +
    `Your official address code is: ${addressCode}. Keep this for your records. - Jimma City Administration`;
  await send(ownerPhone, message, logger);
}
