/**
 * Centralized FloorScribe outbound mail subject/text/category.
 * Callers pass `to` into sendEmail separately.
 */

export function mailPortalOtp(opts: {
  firstName: string;
  organizationName: string;
  code: string;
}): { to?: never; subject: string; text: string; category: "portal-otp" } {
  return {
    subject: `Your FloorScribe code for ${opts.organizationName}`,
    text: `Hi ${opts.firstName},\n\nYour FloorScribe client portal code is ${opts.code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
    category: "portal-otp",
  };
}

export function mailSeekerVerify(opts: {
  firstName: string;
  code: string;
}): {
  subject: string;
  text: string;
  category: "seeker-verify";
} {
  return {
    subject: "Your FloorScribe verification code",
    text: `Hi ${opts.firstName},\n\nYour FloorScribe verification code is ${opts.code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
    category: "seeker-verify",
  };
}

export function mailTrainerVerify(opts: {
  name: string;
  code: string;
}): {
  subject: string;
  text: string;
  category: "trainer-verify";
} {
  return {
    subject: "Your FloorScribe trainer verification code",
    text: `Hi ${opts.name},\n\nYour FloorScribe verification code is ${opts.code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
    category: "trainer-verify",
  };
}

export function inviteAbsoluteUrl(
  token: string,
  appUrl = process.env.APP_URL
): string {
  const base = (appUrl || "https://floorscribe.com").replace(/\/$/, "");
  return `${base}/invite/${token}`;
}

export function mailOrgInvite(opts: {
  orgName: string;
  role: string;
  inviteUrl: string;
}): { subject: string; text: string; category: "org-invite" } {
  return {
    subject: `You're invited to join ${opts.orgName} on FloorScribe`,
    text: `You've been invited to join ${opts.orgName} on FloorScribe as ${opts.role}.\n\nAccept your invite:\n${opts.inviteUrl}\n\nIf you did not expect this, you can ignore this email.`,
    category: "org-invite",
  };
}

export function mailIntroRequested(opts: {
  seekerName: string;
  seekerEmail: string;
  message: string | null;
}): { subject: string; text: string; category: "intro" } {
  return {
    subject: `New intro request from ${opts.seekerName}`,
    text: `${opts.seekerName} (${opts.seekerEmail}) requested an intro.\n\n${opts.message || "(no message)"}\n\nReview intros in FloorScribe.`,
    category: "intro",
  };
}

export function mailIntroRequestedSeeker(opts: {
  trainerName: string;
}): { subject: string; text: string; category: "intro" } {
  return {
    subject: `We sent your intro to ${opts.trainerName}`,
    text: `We sent your intro to ${opts.trainerName}. They will follow up. FloorScribe introduces you; session payments are with the trainer.`,
    category: "intro",
  };
}

export function mailIntroAccepted(opts: { firstName: string }): {
  subject: string;
  text: string;
  category: "intro";
} {
  return {
    subject: "Your FloorScribe intro was accepted",
    text: `${opts.firstName}, a trainer accepted your intro. They'll reach out. You can use /portal/login with this email after they activate you. FloorScribe introduces you; session payments are with the trainer.`,
    category: "intro",
  };
}

export function mailIntroDeclined(): {
  subject: string;
  text: string;
  category: "intro";
} {
  return {
    subject: "Update on your trainer intro",
    text: "The trainer couldn't take this intro right now. You can search again at /find.",
    category: "intro",
  };
}
