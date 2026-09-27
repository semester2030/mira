# Remediation Deployment Evidence

- production service: `mira-api`
- service ID: `srv-d85ngcfavr4c73d3rk6g`
- remediation deploy ID: `dep-daap0o9srm7s73fje0sg`
- requested SHA: `d6a316be6aabaee8123d94584866d23e3cfd5187`
- Render deployed SHA: `d6a316be6aabaee8123d94584866d23e3cfd5187`
- deploy status: `live`
- startup result: PASS

The final configuration-restoration deploy is
`dep-daapbibtqb8s73802dv0`, also live on the exact same remediation SHA.

Rollback target `dep-daafo6dg1s2s73d22sog` remained available. No database
migration was required. No rollback condition occurred.
