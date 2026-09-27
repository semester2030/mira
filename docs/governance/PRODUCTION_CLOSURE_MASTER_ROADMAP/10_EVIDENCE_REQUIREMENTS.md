# Global Evidence Requirements

Every phase package must contain:

1. exact source HEAD, branch and tracked-drift state;
2. entry-condition checklist;
3. redacted configuration/account matrix;
4. commands/tests performed and exit results;
5. real-vs-mock/provider/deployment/device classification;
6. latency labeled as sample unless statistically justified;
7. failure and stop-rule evidence;
8. security/privacy/secret review;
9. owner actions with responsibility and blocking impact;
10. PASS/PARTIAL/BLOCKED verdict and next gate;
11. Technical Reference update after verification;
12. website validation report;
13. archive manifest, file/directory counts and matching SHA256.

Provider payloads must be minimized and sanitized. Never store secrets, tokens,
customer media or unnecessary provider metadata. Mobile artifacts require
cryptographic hashes. Deployment proof requires a trustworthy runtime identity,
not a hardcoded source string.
