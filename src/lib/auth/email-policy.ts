export interface EmailPolicy {
    domains: readonly string[];
    exactEmails: readonly string[];
}
export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
export function validateEmailPolicy(policy: EmailPolicy): EmailPolicy {
    const domains = [...new Set(policy.domains.map(x => x.trim().toLowerCase()))];
    const exactEmails = [...new Set(policy.exactEmails.map(normalizeEmail))];
    if (domains.some(x => !/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(x)) || exactEmails.some(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))
        throw new Error('INVALID_EMAIL_POLICY');
    return { domains, exactEmails };
}
export function emailAllowed(email: string, policy: EmailPolicy): boolean {
    const normalized = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+$/.test(normalized))
        return false;
    const domain = normalized.split('@')[1]!;
    return policy.exactEmails.includes(normalized) || policy.domains.includes(domain);
}
