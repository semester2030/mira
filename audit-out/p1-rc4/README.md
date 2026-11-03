# MIRA P1 Partner Editor Closure RC4

## الحكم
**P1_LOCAL_ACCEPTED_READY_FOR_NEXT_PHASE**

staging / الجهاز / الإنتاج: **NOT_RUN**

## إعادة التحقق
```bash
export MIRA_REPO=/path/to/mira-p1-partner-editor
bash "$MIRA_REPO/audit-out/p1-rc4/REVERIFY.sh"
```
يتطلب `mira-api/.env.rc4` → `mira_p1_rc4_test` على localhost/127.0.0.1.
