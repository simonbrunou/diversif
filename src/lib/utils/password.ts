// Shared between signup/password zod schemas (server) and their matching
// <input minlength> (client) so the two never drift apart.
export const PASSWORD_MIN_LENGTH = 12;
