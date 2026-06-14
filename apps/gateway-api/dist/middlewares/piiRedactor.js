"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.piiRedactor = piiRedactor;
const db_1 = require("@llm-gateway/db");
// Luhn validation for credit cards
function isValidLuhn(ccNum) {
    const sanitized = ccNum.replace(/[- ]/g, '');
    if (!/^\d{13,16}$/.test(sanitized))
        return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = sanitized.length - 1; i >= 0; i--) {
        let digit = parseInt(sanitized.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9)
                digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}
// IPv4 octet validation
function isValidIPv4(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4)
        return false;
    return parts.every((part) => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255 && num.toString() === part;
    });
}
async function piiRedactor(req, res, next) {
    const teamId = req.team_id;
    if (!teamId) {
        return res.status(500).json({ error: 'PII redactor error: Team ID not found on request' });
    }
    try {
        // 1. Check if PII Redaction is enabled for this team
        const result = await db_1.pool.query('SELECT pii_redaction_enabled FROM teams WHERE id = $1', [teamId]);
        if (result.rows.length === 0 || !result.rows[0].pii_redaction_enabled) {
            req.pii_detected = false;
            return next();
        }
        // 2. Perform Redaction on all message content
        const messages = req.body.messages;
        if (!messages || !Array.isArray(messages)) {
            return next();
        }
        let wasPiiDetected = false;
        let replacementCount = 0;
        const emailMap = new Map();
        const phoneMap = new Map();
        const ccMap = new Map();
        const ssnMap = new Map();
        const ipMap = new Map();
        const piiServiceUrl = process.env.PII_SERVICE_URL;
        // Redact each message
        const redactedMessages = [];
        for (const msg of messages) {
            let content = msg.content || '';
            if (typeof content === 'string') {
                // TIER 1: REGEX REDACTION (Always On)
                // Redact Emails
                content = content.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, (match) => {
                    wasPiiDetected = true;
                    if (!emailMap.has(match)) {
                        emailMap.set(match, `[EMAIL_${emailMap.size + 1}]`);
                        replacementCount++;
                    }
                    return emailMap.get(match);
                });
                // Redact SSNs
                content = content.replace(/\b\d{3}-\d{2}-\d{4}\b/g, (match) => {
                    wasPiiDetected = true;
                    if (!ssnMap.has(match)) {
                        ssnMap.set(match, `[SSN_${ssnMap.size + 1}]`);
                        replacementCount++;
                    }
                    return ssnMap.get(match);
                });
                // Redact Credit Cards (with Luhn check)
                content = content.replace(/\b(?:\d[ -]*?){13,16}\b/g, (match) => {
                    if (isValidLuhn(match)) {
                        wasPiiDetected = true;
                        const key = match.replace(/[- ]/g, ''); // Normalize
                        if (!ccMap.has(key)) {
                            ccMap.set(key, `[CREDIT_CARD_${ccMap.size + 1}]`);
                            replacementCount++;
                        }
                        return ccMap.get(key);
                    }
                    return match; // Leave unchanged if not valid Luhn
                });
                // Redact IPv4 Addresses (with octet validation)
                content = content.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (match) => {
                    if (isValidIPv4(match)) {
                        wasPiiDetected = true;
                        if (!ipMap.has(match)) {
                            ipMap.set(match, `[IP_${ipMap.size + 1}]`);
                            replacementCount++;
                        }
                        return ipMap.get(match);
                    }
                    return match;
                });
                // Redact Phone Numbers (International & E.164, min 7 digits, max 15 digits)
                content = content.replace(/\+?\b[0-9]{1,4}[- \s]?(?:\([0-9]{1,3}\)|[0-9]{1,3})[- \s]?[0-9]{1,4}[- \s]?[0-9]{1,4}[- \s]?[0-9]{1,9}\b/g, (match) => {
                    const digits = match.replace(/\D/g, '');
                    if (digits.length >= 7 && digits.length <= 15) {
                        wasPiiDetected = true;
                        if (!phoneMap.has(match)) {
                            phoneMap.set(match, `[PHONE_${phoneMap.size + 1}]`);
                            replacementCount++;
                        }
                        return phoneMap.get(match);
                    }
                    return match;
                });
                // TIER 2: PRESIDIO SIDECAR (Optional, if URL is configured)
                if (piiServiceUrl && content.trim().length > 0) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000);
                    try {
                        const sidecarResponse = await fetch(`${piiServiceUrl}/analyze`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: content }),
                            signal: controller.signal,
                        });
                        clearTimeout(timeoutId);
                        if (sidecarResponse.ok) {
                            const resData = (await sidecarResponse.json());
                            content = resData.redacted_text;
                            if (resData.entities_found && resData.entities_found.length > 0) {
                                wasPiiDetected = true;
                            }
                        }
                        else {
                            console.warn('[PII Sidecar] Request failed with status', sidecarResponse.status);
                        }
                    }
                    catch (err) {
                        clearTimeout(timeoutId);
                        // Fail-safe: log warning but don't block. Raw PII is NOT printed.
                        console.warn('[PII Sidecar] Request failed or timed out. Falling back to Tier 1 regex results.');
                    }
                }
            }
            redactedMessages.push({
                ...msg,
                content,
            });
        }
        // Replace request messages with the redacted ones
        req.body.messages = redactedMessages;
        req.pii_detected = wasPiiDetected;
        next();
    }
    catch (error) {
        console.error('PII Redaction middleware error:', error);
        // Fail-open
        next();
    }
}
//# sourceMappingURL=piiRedactor.js.map