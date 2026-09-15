export function inviteProblem(invite) {
  if (!invite) return { status: 404, message: 'This invite code is not valid. Check it and try again.' };
  if (invite.revokedAt) return { status: 410, message: 'This invite has been revoked. Ask the group owner for a new one.' };
  if (invite.expired) return { status: 410, message: 'This invite has expired. Ask the group owner for a new one.' };
  return null;
}
