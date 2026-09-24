function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim();
  const sender = messagingServiceSid || fromNumber;

  if (!accountSid || !authToken || !sender) {
    return null;
  }

  const isServiceSid = sender.startsWith("MG");
  return { accountSid, authToken, sender, isServiceSid };
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
  if (phone.trim().startsWith("+")) {
    return phone.trim();
  }
  return `+${digits}`;
}

async function sendTwilioSms(
  to: string,
  message: string,
  logger?: { error: (obj: unknown, msg: string) => void; info?: (obj: unknown, msg: string) => void },
): Promise<void> {
  const config = getTwilioConfig();
  if (!config) {
    console.warn(
      "[Twilio SMS] TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID (or TWILIO_PHONE_NUMBER) not set. Skipping SMS.",
    );
    return;
  }

  const formattedTo = formatPhone(to);
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
  const authHeader = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`;

  const bodyParams = new URLSearchParams();
  bodyParams.append("To", formattedTo);
  if (config.isServiceSid) {
    bodyParams.append("MessagingServiceSid", config.sender);
  } else {
    bodyParams.append("From", config.sender);
  }
  bodyParams.append("Body", message);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errPayload = {
        status: response.status,
        code: (data as { code?: number }).code,
        message: (data as { message?: string }).message ?? "Twilio API error",
        to: formattedTo,
      };
      if (logger) {
        logger.error(errPayload, "Failed to send Twilio SMS");
      } else {
        console.error("[Twilio SMS] Error sending SMS:", errPayload);
      }
      return;
    }

    const sid = (data as { sid?: string }).sid;
    if (logger?.info) {
      logger.info({ sid, to: formattedTo }, "Twilio SMS dispatched successfully");
    } else {
      console.log(`[Twilio SMS] Dispatched to ${formattedTo} (SID: ${sid})`);
    }
  } catch (err) {
    if (logger) {
      logger.error({ err, to: formattedTo }, "Network/unexpected error sending Twilio SMS");
    } else {
      console.error("[Twilio SMS] Unexpected error:", err);
    }
  }
}

export async function sendKebeleVerifiedSms(
  ownerName: string,
  ownerPhone: string,
  propertyAddress: string,
  logger?: { error: (obj: unknown, msg: string) => void; info?: (obj: unknown, msg: string) => void },
): Promise<void> {
  const message =
    `Dear ${ownerName}, your property (${propertyAddress}) has been VERIFIED by the Kebele Officer. ` +
    `It is now awaiting final approval from the City Office. - Agaro City Administration`;
  await sendTwilioSms(ownerPhone, message, logger);
}

export async function sendCityApprovedSms(
  ownerName: string,
  ownerPhone: string,
  addressCode: string,
  logger?: { error: (obj: unknown, msg: string) => void; info?: (obj: unknown, msg: string) => void },
): Promise<void> {
  const message =
    `Dear ${ownerName}, your property has been OFFICIALLY APPROVED by Agaro City Administration. ` +
    `Your official address code is: ${addressCode}. Keep this for your records. - Agaro City Administration`;
  await sendTwilioSms(ownerPhone, message, logger);
}

export async function sendKebeleOfficerSubmissionSms(
  officerPhone: string,
  propertyAddress: string,
  kebele: string,
  ownerName: string,
  logger?: { error: (obj: unknown, msg: string) => void; info?: (obj: unknown, msg: string) => void },
): Promise<void> {
  const message =
    `[ACTION REQUIRED] A new property (${propertyAddress}) in Kebele ${kebele} (Owner: ${ownerName}) ` +
    `has been submitted by the field enumerator and is ready for your verification. - Agaro City Administration`;
  await sendTwilioSms(officerPhone, message, logger);
}

export async function sendCityOfficerApprovalNeededSms(
  officerPhone: string,
  propertyAddress: string,
  kebele: string,
  ownerName: string,
  logger?: { error: (obj: unknown, msg: string) => void; info?: (obj: unknown, msg: string) => void },
): Promise<void> {
  const message =
    `[ACTION REQUIRED] Property (${propertyAddress}) in Kebele ${kebele} (Owner: ${ownerName}) ` +
    `has been VERIFIED by the Kebele Officer and is waiting for your final City approval. - Agaro City Administration`;
  await sendTwilioSms(officerPhone, message, logger);
}

