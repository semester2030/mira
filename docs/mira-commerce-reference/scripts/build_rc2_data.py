#!/usr/bin/env python3
"""RC2 study data: evidence excerpts + corrected JSON. Does not touch product code."""
from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
DATA = ROOT / "data"
EVD = ROOT / "evidence"
COMMIT = "15fe65c40d3dedb9afdd95619f2945bd84cb616a"
NOW = "2026-09-23T03:43:29+03:00"
ACCESS = "2026-09-23"


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def dump(name, obj):
    (DATA / name).write_text(
        json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def write_excerpt(evd_id, rel, start, end, note):
    src = REPO / rel
    text = src.read_text(encoding="utf-8")
    digest = sha256_text(text)
    lines = text.splitlines()
    body = [
        f"id={evd_id}",
        f"path={rel}",
        f"commit={COMMIT}",
        f"sha256={digest}",
        f"lines={start}-{end}",
        f"note={note}",
        "runtime=SOURCE_ONLY",
        "---",
    ]
    for n in range(start, end + 1):
        body.append(f"{n}|{lines[n - 1]}")
    out = EVD / "source" / f"{evd_id}.txt"
    out.write_text("\n".join(body) + "\n", encoding="utf-8")
    return digest


def evd_obj(i, claim, claim_type, path, lines, digest, excerpt, proves, does_not, limits):
    return {
        "id": i,
        "claim": claim,
        "claimType": claim_type,
        "repo": "mira",
        "path": path,
        "symbol": "",
        "lines": lines,
        "commitSha": COMMIT,
        "fileSha256": digest,
        "excerptFile": excerpt,
        "proves": proves,
        "doesNotProve": does_not,
        "runtime": "SOURCE_ONLY",
        "limitations": limits,
    }


def main():
    (EVD / "source").mkdir(parents=True, exist_ok=True)
    (EVD / "commands").mkdir(parents=True, exist_ok=True)
    (EVD / "git").mkdir(parents=True, exist_ok=True)
    (EVD / "tests").mkdir(parents=True, exist_ok=True)

    excerpts = {
        "EVD-0011": write_excerpt(
            "EVD-0011",
            "mira-api/src/partners-portal/partners-portal.controller.ts",
            38,
            130,
            "مسارات التسجيل والدخول والكتالوج والإدارة على المتحكم",
        ),
        "EVD-0012": write_excerpt(
            "EVD-0012",
            "mira-api/src/partners-portal/guards/partner-token.guard.ts",
            14,
            38,
            "partnerId يُستخرج من سجل PartnerUser المرتبط بالرمز",
        ),
        "EVD-0013": write_excerpt(
            "EVD-0013",
            "mira-api/src/partners-portal/partners-portal.service.ts",
            282,
            412,
            "عزل المالك في التعديل والحذف؛ trackEvent يأخذ partnerId من الجسم",
        ),
        "EVD-0014": write_excerpt(
            "EVD-0014",
            "mira-api/src/admin/admin.controller.ts",
            24,
            109,
            "لوحة الإدارة محمية بمفتاح وتدير الشركاء والطلبات",
        ),
        "EVD-0015": write_excerpt(
            "EVD-0015",
            "admin-portal/web/js/api.js",
            1,
            79,
            "عميل لوحة الإدارة يرسل X-Admin-Key ولا يرسل partnerId للكتابة",
        ),
        "EVD-0016": write_excerpt(
            "EVD-0016",
            "partners-portal/web/js/api.js",
            1,
            79,
            "عميل بوابة الشركاء: الجلسة محلية والكتابة عبر Bearer",
        ),
        "EVD-0017": write_excerpt(
            "EVD-0017",
            "mira-api/src/partners-portal/dto/catalog.dto.ts",
            13,
            90,
            "عقد المنتج الحالي بلا متغير أو مخزون أو وسائط",
        ),
        "EVD-0020": write_excerpt(
            "EVD-0020",
            "lib/core/config/mira_features.dart",
            14,
            46,
            "أعلام الاشتراك والسوق افتراضيًا من بيئة البناء",
        ),
        "EVD-0021": write_excerpt(
            "EVD-0021",
            "mira-api/src/partners-portal/partners-portal.service.ts",
            102,
            125,
            "الدخول يطابق البريد والرمز ثم يعيد هوية الشريك من السجل",
        ),
        "EVD-0025": write_excerpt(
            "EVD-0025",
            "mira-api/src/common/guards/admin-api-key.guard.ts",
            10,
            26,
            "صلاحية الإدارة مفتاح مشترك وليست دور مستخدم",
        ),
        "EVD-0026": write_excerpt(
            "EVD-0026",
            "mira-api/src/partners-portal/partners-portal.service.spec.ts",
            105,
            121,
            "اختبار وحدة يرفض تحديث منتج شريك آخر عبر mock",
        ),
    }

    for src, dest in [
        ("/tmp/cmd-rc2-0001.txt", "CMD-RC2-0001-order-cart.txt"),
        ("/tmp/cmd-rc2-0002.txt", "CMD-RC2-0002-models.txt"),
        ("/tmp/cmd-rc2-0003.txt", "CMD-RC2-0003-video-creator.txt"),
        ("/tmp/cmd-rc2-0004.txt", "CMD-RC2-0004-video-player.txt"),
    ]:
        shutil.copy(src, EVD / "commands" / dest)

    head = (REPO / ".git").exists()
    import subprocess

    def git(*args):
        return subprocess.check_output(["git", "-C", str(REPO), *args], text=True)

    (EVD / "git" / "HEAD.txt").write_text(git("rev-parse", "HEAD"), encoding="utf-8")
    (EVD / "git" / "LOG.txt").write_text(
        git("log", "-1", "--format=%H%n%s%n%ci"), encoding="utf-8"
    )
    status = git("status", "--porcelain")
    (EVD / "git" / "STATUS.txt").write_text(
        "branch=" + git("branch", "--show-current") + "\n" + status, encoding="utf-8"
    )
    (EVD / "git" / "BASELINE_DIFF_NOTE.txt").write_text(
        "previousBaselineCommit=" + COMMIT + "\n"
        "rc2InspectedCommit=" + git("rev-parse", "HEAD").strip() + "\n"
        "inspectedAt=" + NOW + "\n"
        "workingTree=dirty files listed in STATUS.txt are outside this study task.\n"
        "This study must not attribute those edits to RC2 and must not reset them.\n",
        encoding="utf-8",
    )

    evidence = load("evidence-index.json")
    for e in evidence:
        if e["id"] == "EVD-0007":
            e["claimType"] = "document"
            e["doesNotProve"] = (
                "ملف مواصفات. لا يثبت أن بوابة الشركاء مفعلة في الإنتاج، "
                "ولا يغني عن قراءة المتحكم والحارس."
            )
            e["limitations"] = "SPEC فقط. راجع EVD-0011 وما بعده للتنفيذ."
        if e["id"] == "EVD-0010":
            e["claimType"] = "search-summary"
            e["doesNotProve"] = (
                "الملف السابق ملخص مكتوب وليس سجل أمر. لا ينفي وجود الطلب "
                "خارج المسارات المفحوصة. السجل القابل للمراجعة هو EVD-0018."
            )
            e["limitations"] = "ملخص غير كافٍ. أُبقي كدليل على قصور النسخة السابقة."
        if e["id"] == "EVD-0005":
            e["doesNotProve"] = (
                "مقتطف المخطط يثبت شكل الجداول المعروضة فيه فقط. "
                "لا ينفي جداول خارج النطاق أو في خدمة أخرى."
            )
    new_items = [
        evd_obj(
            "EVD-0011",
            "متحكم بوابة الشركاء ينفذ التقديم والدخول وCRUD والاعتماد",
            "fact",
            "mira-api/src/partners-portal/partners-portal.controller.ts",
            "38-130",
            excerpts["EVD-0011"],
            "evidence/source/EVD-0011.txt",
            "وجود مسارات في المصدر",
            "لا يثبت نشرًا أو تفعيلًا في الإنتاج",
            "SOURCE_ONLY",
        ),
        evd_obj(
            "EVD-0012",
            "partnerId يُؤخذ من الرمز المخزن وليس من جسم طلب الكتالوج",
            "fact",
            "mira-api/src/partners-portal/guards/partner-token.guard.ts",
            "14-38",
            excerpts["EVD-0012"],
            "evidence/source/EVD-0012.txt",
            "مصدر partnerId في الطلبات المحمية",
            "لا يثبت أن كل المسارات محمية؛ track بلا حارس",
            "SOURCE_ONLY",
        ),
        evd_obj(
            "EVD-0013",
            "تعديل وحذف المنتج والخدمة يشترطان partnerId المالك؛ التتبع يقبل معرف العميل",
            "fact",
            "mira-api/src/partners-portal/partners-portal.service.ts",
            "282-412",
            excerpts["EVD-0013"],
            "evidence/source/EVD-0013.txt",
            "عزل الكتابة على الكتالوج في المصدر، وثغرة كتابة أحداث التتبع",
            "لا يثبت عزلًا على قاعدة إنتاج حية",
            "SOURCE_ONLY",
        ),
        evd_obj(
            "EVD-0014",
            "متحكم الإدارة يسرد الشركاء ويعتمد الطلبات ويوقف الشريك",
            "fact",
            "mira-api/src/admin/admin.controller.ts",
            "24-109",
            excerpts["EVD-0014"],
            "evidence/source/EVD-0014.txt",
            "وجود مسارات إدارة في المصدر خلف AdminApiKeyGuard",
            "لا يثبت أن المفتاح مضبوط في الإنتاج أو أن الواجهة منشورة",
            "SOURCE_ONLY",
        ),
        evd_obj(
            "EVD-0015",
            "واجهة الإدارة الثابتة تستدعي /admin بمفتاح محلي",
            "fact",
            "admin-portal/web/js/api.js",
            "1-79",
            excerpts["EVD-0015"],
            "evidence/source/EVD-0015.txt",
            "عميل لوحة الإدارة موجود في المستودع",
            "العنوان الافتراضي localhost. لا يثبت نشر admin.mira.app",
            "SOURCE_ONLY",
        ),
        evd_obj(
            "EVD-0016",
            "واجهة الشركاء تستدعي مسارات partners-portal",
            "fact",
            "partners-portal/web/js/api.js",
            "1-79",
            excerpts["EVD-0016"],
            "evidence/source/EVD-0016.txt",
            "عميل البوابة يطابق مسارات الخادم",
            "لا يثبت جلسة إنتاج أو عزلًا من جهة المتصفح وحده",
            "SOURCE_ONLY",
        ),
        evd_obj(
            "EVD-0017",
            "عقد إنشاء المنتج بلا مقاس أو لون أو مخزون أو وسيط",
            "fact",
            "mira-api/src/partners-portal/dto/catalog.dto.ts",
            "13-90",
            excerpts["EVD-0017"],
            "evidence/source/EVD-0017.txt",
            "شكل الإدخال الحالي للشريك",
            "لا ينفي حقولًا في عميل آخر لم يُفحص",
            "SOURCE_ONLY داخل هذا الملف",
        ),
        evd_obj(
            "EVD-0018",
            "بحث Order/Cart/Booking داخل المسارات المحددة لم يُرجع تطابقًا",
            "search",
            "evidence/commands/CMD-RC2-0001-order-cart.txt",
            "n/a",
            sha256_text((EVD / "commands" / "CMD-RC2-0001-order-cart.txt").read_text(encoding="utf-8")),
            "evidence/commands/CMD-RC2-0001-order-cart.txt",
            "لا تطابق للنماذج المذكورة داخل النطاق وexit=1",
            "لا ينفي منظومة تجارة خارج المستودع أو بأسماء مختلفة",
            "نطاق الأمر مذكور في الملف",
        ),
        evd_obj(
            "EVD-0019",
            "لا نماذج Branch/Employee/ProductVariant/MediaAsset/Creator في schema",
            "search",
            "evidence/commands/CMD-RC2-0002-models.txt",
            "n/a",
            sha256_text((EVD / "commands" / "CMD-RC2-0002-models.txt").read_text(encoding="utf-8")),
            "evidence/commands/CMD-RC2-0002-models.txt",
            "لا تطابق لتلك النماذج في mira-api/prisma وexit=1",
            "لا ينفي الجداول إن وُجدت خارج هذا الملف",
            "بحث أسماء محددة",
        ),
        evd_obj(
            "EVD-0020",
            "علم الاشتراك وعلم السوق يُقرآن من dart-define وافتراضهما false",
            "fact",
            "lib/core/config/mira_features.dart",
            "14-46",
            excerpts["EVD-0020"],
            "evidence/source/EVD-0020.txt",
            "الإخفاء في بناء التطبيق يعتمد على العلم",
            "لا يثبت قيمة العلم في بناء المتجر المنشور",
            "SOURCE_ONLY",
        ),
        evd_obj(
            "EVD-0021",
            "الدخول يربط الجلسة بسجل PartnerUser",
            "fact",
            "mira-api/src/partners-portal/partners-portal.service.ts",
            "102-125",
            excerpts["EVD-0021"],
            "evidence/source/EVD-0021.txt",
            "مصدر هوية الشريك بعد الدخول",
            "الرمز نفسه سر الدخول؛ لا كلمة مرور منفصلة في هذا المسار",
            "SOURCE_ONLY",
        ),
        evd_obj(
            "EVD-0022",
            "خط أساس RC2 يطابق commit الدراسة السابقة وشجرة العمل متسخة خارج الدراسة",
            "search",
            "evidence/git/HEAD.txt",
            "n/a",
            sha256_text((EVD / "git" / "HEAD.txt").read_text(encoding="utf-8")),
            "evidence/git/STATUS.txt",
            "HEAD والفرع وحالة الشجرة وقت الفحص",
            "لا يصف محتوى كل ملف متسخ",
            "لم يُعاد ضبط المستودع",
        ),
        evd_obj(
            "EVD-0023",
            "لا رموز فيديو منتج أو مشاهير أو متغير في النطاق المبحوث",
            "search",
            "evidence/commands/CMD-RC2-0003-video-creator.txt",
            "n/a",
            sha256_text((EVD / "commands" / "CMD-RC2-0003-video-creator.txt").read_text(encoding="utf-8")),
            "evidence/commands/CMD-RC2-0003-video-creator.txt",
            "exit=1 للأنماط المذكورة",
            "غياب الكلمة ليس غياب كل وسيط في العالم",
            "نطاق محدد في رأس الملف",
        ),
        evd_obj(
            "EVD-0024",
            "لا VideoPlayer أو video_player في lib وmira-api/src",
            "search",
            "evidence/commands/CMD-RC2-0004-video-player.txt",
            "n/a",
            sha256_text((EVD / "commands" / "CMD-RC2-0004-video-player.txt").read_text(encoding="utf-8")),
            "evidence/commands/CMD-RC2-0004-video-player.txt",
            "exit=1 داخل المسارين",
            "لا يشمل تطبيقات ويب ثابتة أو أصولًا ثنائية",
            "نمط بحث محدد",
        ),
        evd_obj(
            "EVD-0025",
            "الإدارة تُفوَّض بمفتاح API مشترك",
            "fact",
            "mira-api/src/common/guards/admin-api-key.guard.ts",
            "10-26",
            excerpts["EVD-0025"],
            "evidence/source/EVD-0025.txt",
            "فرق الصلاحية عن شريك واحد",
            "لا يثبت تدوير المفتاح أو تخزينه",
            "SOURCE_ONLY",
        ),
        evd_obj(
            "EVD-0026",
            "اختبار وحدة لعزل تحديث المنتج بين شريكين",
            "fact",
            "mira-api/src/partners-portal/partners-portal.service.spec.ts",
            "105-121",
            excerpts["EVD-0026"],
            "evidence/source/EVD-0026.txt",
            "العزل مقصود في الاختبار وعلى mock",
            "ليس اختبار قاعدة بيانات حية ولا إنتاجًا",
            "UNIT_MOCK",
        ),
    ]
    # EVD-0022 excerptFile points at STATUS which is the reviewable artifact; fileSha256 is HEAD.
    # Validator hashes excerpt path when claimType is search and path is under evidence/.
    evidence.extend(new_items)
    dump("evidence-index.json", evidence)

    caps = load("capabilities.json")
    cap_patch = {
        "CAP-0001": {
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0005", "EVD-0006"],
            "judgmentNoteAr": "الكود موجود. تفعيل الإنتاج غير مثبت لأن التحقق SOURCE_ONLY.",
        },
        "CAP-0002": {
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0006"],
            "judgmentNoteAr": "مسار مطابقة في المتحكم العام. لا دليل تشغيل.",
        },
        "CAP-0003": {
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0001", "EVD-0002"],
            "judgmentNoteAr": "العلم الافتراضي false يخفي الواجهة في المصدر. وصول API الإنتاج UNKNOWN.",
        },
        "CAP-0004": {
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0004", "EVD-0007"],
            "judgmentNoteAr": "الشراء في الشاشة رابط خارجي. SPEC وثيقة لا تثبت التفعيل.",
        },
        "CAP-0005": {
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0003"],
            "judgmentNoteAr": "الزر stub في المصدر. ليست خدمة مكتملة متوقفة.",
        },
        "CAP-0006": {
            "existence": "ABSENT_AFTER_SEARCH",
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0018", "EVD-0010"],
            "judgmentNoteAr": "الغياب محصور بنطاق البحث في EVD-0018. الملخص القديم EVD-0010 غير كافٍ وحده.",
        },
        "CAP-0007": {
            "existence": "EXISTING",
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0011", "EVD-0012", "EVD-0013", "EVD-0016", "EVD-0021", "EVD-0007"],
            "judgmentNoteAr": "التنفيذ موجود في المصدر. EVD-0007 مواصفات فقط. التفعيل الإنتاجي غير مثبت.",
        },
        "CAP-0008": {
            "existence": "EXISTING",
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0014", "EVD-0015", "EVD-0025"],
            "judgmentNoteAr": "أُضيف دليل المتحكم والعميل. لا يُصنف مفعّلًا في الإنتاج من الشيفرة.",
        },
        "CAP-0009": {
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0008"],
            "judgmentNoteAr": "بذرة محلية في المصدر عند غياب الشبكة. ليست كتالوج إنتاج.",
        },
        "CAP-0010": {
            "existence": "ABSENT_AFTER_SEARCH",
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0023", "EVD-0024"],
            "judgmentNoteAr": "لا تطابق لأنماط الفيديو المتتابع داخل النطاق. ليس حكمًا على كل مستودع خارج الفحص.",
        },
        "CAP-0011": {
            "existence": "ABSENT_AFTER_SEARCH",
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0023", "EVD-0019"],
            "judgmentNoteAr": "لا نموذج مشاهير في النطاق المبحوث.",
        },
        "CAP-0012": {
            "existence": "ABSENT_AFTER_SEARCH",
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0017", "EVD-0019", "EVD-0005"],
            "judgmentNoteAr": "العقد والمخطط المبحوثان بلا متغير. المقتطف وحده لا ينفي المشروع كله؛ البحث الأوسع في EVD-0019.",
        },
        "CAP-0013": {
            "existence": "PARTIAL",
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0017", "EVD-0006"],
            "judgmentNoteAr": "concernTags وskinTypes موجودان. فلاتر المقاس واللون غير موجودة في العقد.",
        },
        "CAP-0014": {
            "existence": "EXISTING",
            "activation": "UNKNOWN",
            "evidenceIds": ["EVD-0020"],
            "judgmentNoteAr": "مسار اشتراك رصيد منفصل عن المتجر. العلم الافتراضي false في المصدر. ليس دليل إيقاف إنتاجي مستقل.",
        },
    }
    for c in caps:
        c.update(cap_patch[c["id"]])
        c["verification"] = "SOURCE_ONLY"
    dump("capabilities.json", caps)

    paused = [
        {
            "id": "PAUSE-0001",
            "nameAr": "Discover في التطبيق",
            "previousClassificationAr": "خدمة متوقفة موثقة بسبب عبارة الانطلاق قريبًا، وAPI يمكن الوصول إليه",
            "correctedClassificationAr": "إخفاء واجهة في المصدر عبر علم بناء. سبب الإيقاف التاريخي غير موثق تشغيليًا.",
            "classification": "UI_FLAG_DEFAULT_OFF",
            "uiHidden": "true-in-source",
            "navigationBlocked": "true-in-client-routes",
            "serverFeatureGate": "UNKNOWN",
            "apiReachableDespiteUiHide": "UNKNOWN",
            "logicCompleteness": "PARTIAL",
            "externalDependencyMissing": "UNKNOWN",
            "documentedReason": "التعليق «الانطلاق قريبًا» نص واجهة. الآلية التقنية في المصدر هي MIRA_MARKETPLACE_ENABLED الافتراضي false. لا وثيقة تشغيل تشرح سبب الإيقاف.",
            "reasonClass": "سبب تاريخي غير موثق؛ الآلية في المصدر موثقة",
            "evidenceIds": ["EVD-0001", "EVD-0002", "EVD-0006"],
            "reactivationNeeds": ["قرار مالك", "معرفة قيمة العلم في البناء المنشور", "مراجعة الكتالوج قبل الإظهار"],
            "reactivationRisks": ["إظهار بذرة محلية كأنها متجر حي"],
        },
        {
            "id": "PAUSE-0002",
            "nameAr": "الحجز الإلكتروني",
            "previousClassificationAr": "خدمة متوقفة",
            "correctedClassificationAr": "مسار غير مكتمل في التصميم الحالي، وليس خدمة أُوقفت بعد اكتمالها.",
            "classification": "NEVER_COMPLETED_STUB",
            "uiHidden": "button-disabled-or-snackbar",
            "navigationBlocked": "UNKNOWN",
            "serverFeatureGate": "no-booking-model-in-searched-schema",
            "apiReachableDespiteUiHide": "UNKNOWN",
            "logicCompleteness": "STUB",
            "externalDependencyMissing": "UNKNOWN",
            "documentedReason": "الزر في الشاشة لا ينشئ حجزًا. لا يوجد model Booking في البحث EVD-0018. لا سبب تشغيلي تاريخي منفصل.",
            "reasonClass": "غير منفذ حتى الاكتمال",
            "evidenceIds": ["EVD-0003", "EVD-0018", "EVD-0017"],
            "reactivationNeeds": ["عقد حجز", "مواعيد", "لا يكفي إعادة تشغيل خادم"],
            "reactivationRisks": ["اعتبار الزر الحالي حجزًا حقيقيًا"],
        },
        {
            "id": "PAUSE-0003",
            "nameAr": "شراء داخل ميرا",
            "previousClassificationAr": "خدمة متوقفة لأن SPEC يقول الدفع عند الشريك",
            "correctedClassificationAr": "غير منفذ في التصميم الحالي. ليس خدمة تحتاج إعادة تشغيل.",
            "classification": "NEVER_BUILT",
            "uiHidden": "buy-opens-external-url",
            "navigationBlocked": "not-applicable",
            "serverFeatureGate": "no-order-model-in-searched-scope",
            "apiReachableDespiteUiHide": "UNKNOWN",
            "logicCompleteness": "NOT_IMPLEMENTED",
            "externalDependencyMissing": "UNKNOWN",
            "documentedReason": "الشاشة تفتح externalUrl. المواصفات تقول الدفع عند الشريك. لا سجل تشغيلي يقول إن شراءً داخليًا كان يعمل ثم أُوقف.",
            "reasonClass": "تصميم خارجي وليس إيقافًا",
            "evidenceIds": ["EVD-0004", "EVD-0007", "EVD-0018"],
            "reactivationNeeds": ["DEC-0001 قبل أي بناء"],
            "reactivationRisks": ["بناء سلة فوق مسار رابط خارجي دون قرار"],
        },
    ]
    dump("paused-services.json", paused)

    acceptances = {
        "REQ-0001": ("منتج شريك موجود بهوية ثابتة", "إنشاء منتج ثانٍ ثم تعديل سعر الأول", "يبقى معرف المنتج الأول وتاريخه، ويتغير السعر المسجل دون إنشاء منتج جديد", ["رفض اسم فارغ", "رفض سعر سالب"], "اختبار خدمة على قاعدة اختبار", "سجل المنتج قبل وبعد مع المعرف"),
        "REQ-0002": ("منتج له متغيران لون×مقاس", "طلب المتغير الأزرق M المتوفر", "يُختار متغير واحد تتطابق خصائصه كلها", ["متغير بلا مخزون لا يُباع", "دمج لون من متغير ومقاس من آخر"], "اختبار استعلام المتغير", "صف المتغير المطابق فقط"),
        "REQ-0003": ("طلب انضمام عيادة", "اعتماد الإدارة ثم إضافة خدمة وفرع", "الخدمة ترتبط بالمنشأة والفرع لا بمنتج عام", ["عيادة بلا ترخيص موثق تبقى قيد المراجعة"], "اختبار الاعتماد ومسار الفرع", "سجل الفرع والخدمة"),
        "REQ-0004": ("ملف فيديو ضمن الحدود", "رفعه وربطه بمنتج", "لا يُعرض قبل المراجعة، ويشير إلى المنتج الأصلي", ["رفض نوع غير مسموح", "فشل المعالجة يبقي الحالة فشل"], "اختبار دورة الوسائط", "حالات الوسيط"),
        "REQ-0005": ("ثلاثة مقاطع منشورة", "تمرير عمودي مع صوت", "مقطع واحد مسموع، واستئناف الموضع عند العودة", ["تداخل صوت مقطعين", "اقتصاص خارج الإطار"], "اختبار واجهة على جهاز", "تسجيل شاشة ولقطات"),
        "REQ-0006": ("شريك معتمد", "فتح صفحته العامة من التطبيق", "تظهر منتجاته النشطة فقط ورابط متجره", ["منتجات شريك آخر لا تُخلط"], "اختبار عرض المتجر", "قائمة المنتجات المعروضة"),
        "REQ-0007": ("إعلان مشهور مربوط بمنتج", "تغيير سعر المنتج ومخزونه", "الإعلان يقرأ السعر والمخزون من المنتج ولا يخزن نسخة", ["رفض نشر إعلان بلا منتج"], "اختبار عدم النسخ", "مقارنة حقول الإعلان والمنتج"),
        "REQ-0008": ("أطراف الناشر والمعلن والبائع مختلفة", "فتح الإعلان ثم الشراء", "الطلب يُنسب للبائع والمحتوى للناشر", ["خلط هوية المعلن مع البائع"], "اختبار الإسناد", "سجل الأطراف"),
        "REQ-0009": ("وسيط قيد المراجعة", "محاولة تشغيله في التصفح", "لا يظهر في الخلاصة العامة", ["نشر بلا مراجعة"], "اختبار حالات النشر", "حالة الوسيط قبل وبعد"),
        "REQ-0010": ("إعلان بانتظار موافقة المتجر", "المتجر يرفض الربط", "يختفي من العرض ويبقى المنتج", ["ربط بلا موافقة"], "اختبار حالة الربط", "سجل الموافقة"),
        "REQ-0011": ("طلب على متغير محدد", "تغيير سعر المتغير لاحقًا", "الطلب يحتفظ بسعر ونسخة المتغير وقت الإنشاء", ["الطلب يتبع السعر الجديد صامتًا"], "اختبار لقطة الطلب", "لقطة السعر"),
        "REQ-0012": ("مستخدم على مقطع منتج", "يختار شراء أو حجز أو استفسار", "كل مسار يفتح وجهته دون تحويل الكل إلى الشراء", ["زر واحد لكل المسارات"], "اختبار الرحلة", "سجل المسار المختار"),
        "REQ-0013": ("فستان أزرق M متوفر وفستان أزرق S غير متوفر", "فلتر لون أزرق AND مقاس M AND متوفر", "منتج واحد ومتغير واحد", ["مطابقة اللون من متغير والمقاس من آخر"], "اختبار المثال المرجعي", "هوية المتغير المطابق"),
        "REQ-0014": ("كتالوج أكبر من صفحة", "فلتر مع ترتيب وترقيم", "العدد الكلي صحيح والصفحة لا تكرر صفًا", ["فلترة على العميل بعد جلب الكل"], "اختبار الاستعلام", "العد ورقم الصفحة"),
        "REQ-0015": ("حدث نقرة على منتج", "تسجيله ثم عرضه للشريك المالك", "الحدث مرتبط بالشريك والهدف", ["شريك يسجل حدثًا لشريك آخر من جسم الطلب"], "اختبار التتبع بعد سد الثغرة", "سجل الحدث والمالك"),
        "REQ-0016": ("رمزان لشريكين", "الشريك أ يحاول تعديل منتج ب", "الرفض دون تسريب وجود المنتج", ["قبول partnerId من الجسم في الكتابة"], "اختبار العزل على قاعدة اختبار", "استدعاء assert والنتيجة"),
        "REQ-0017": ("نتيجة تحليل بشرة وإعلان مدفوع", "عرض التوصية", "الإعلان موسوم مدفوعًا ولا يُقدَّم كنتيجة تحليل", ["خلط الإعلان مع درجة البشرة"], "اختبار العرض", "لقطة التمييز"),
        "REQ-0018": ("جداول Partner وProduct الحالية", "إضافة متغير دون جدول منتج موازٍ", "المنتجات القديمة تبقى قابلة للقراءة", ["نسخ الكتالوج إلى مخطط جديد"], "مراجعة الترحيل", "خطة الترحيل والاختبار"),
        "REQ-0019": ("منتج وخدمة", "إظهار الأفعال المتاحة", "الشراء والحجز والاستفسار والاتصال أزرار مختلفة حسب النوع", ["حجز على منتج مادي بلا خدمة"], "اختبار الأفعال", "مصفوفة الأزرار"),
        "REQ-0020": ("قرار نطاق البث الحي ما زال مفتوحًا", "مراجع الدراسة", "لا تُبنى شاشة بث ولا تُغلق الدراسة بانتظارها", ["اعتبار البث متطلب إطلاق"], "مراجعة DEC-0002", "نص القرار وحالته"),
    }
    reqs = load("requirements.json")
    for r in reqs:
        g, a, e, f, t, ev = acceptances[r["id"]]
        r["acceptance"] = {
            "given": g,
            "action": a,
            "expected": e,
            "failures": f,
            "testMethod": t,
            "evidenceRequired": ev,
        }
        r["acceptanceAr"] = f"المعطى: {g}. الإجراء: {a}. المتوقع: {e}."
        r["planPlacement"] = "future-gate"
    reqs[-1]["planPlacement"] = "scope-decision"
    dump("requirements.json", reqs)

    roadmap = [
        {
            "id": "GATE-00",
            "titleAr": "التدقيق والدراسة والموقع",
            "status": "in_progress",
            "goalAr": "دراسة مرجعية قابلة للمراجعة بلا تنفيذ منتج",
            "scopeAr": "المصدر والموقع والحزمة فقط",
            "reqIds": [],
            "decisionIds": ["DEC-0005"],
            "dependsOn": [],
            "likelyUnits": ["docs/mira-commerce-reference"],
            "reuseAr": "لا إعادة استخدام وظيفي في هذه المرحلة",
            "risksAr": ["إغلاق البوابة قبل كفاية الأدلة"],
            "effortAr": "مكتمل كمسودة RC2؛ المراجعة البشرية خارج التقدير",
            "effortAssumptionsAr": "لا يشمل تنفيذ المتجر",
            "entryCriteriaAr": ["تكليف دراسة بلا تعديل منتج"],
            "exitCriteriaAr": [
                "الموقع يعرض النتائج والأدلة والملاحظات داخل أقسامه",
                "الحزمة وSHA-256 متاحان للمراجع",
                "لم يُغلق GATE-00 ولم يُعتمد القرار DEC-0005 من هذه الدراسة",
                "لم يُعدَّل سلوك تطبيق أو خادم التجارة",
            ],
            "proofPackAr": ["الموقع", "ZIP", "سجل الاختبارات", "سجل الملاحظات"],
            "rollbackAr": "حذف حزمة الدراسة لا يرجع منتجًا لأن المنتج لم يُمس",
        },
        {
            "id": "GATE-01",
            "titleAr": "هوية الكتالوج والعزل وإعادة الاستخدام",
            "status": "planned",
            "goalAr": "منتج وخدمة وفرع ومتغير فوق الجداول الحالية مع عزل الشريك",
            "scopeAr": "الخادم وويب الشركاء والبيانات ولوحة الإدارة. ليس واجهة الفيديو.",
            "reqIds": ["REQ-0001", "REQ-0002", "REQ-0003", "REQ-0006", "REQ-0016", "REQ-0018"],
            "decisionIds": ["DEC-0003"],
            "dependsOn": ["GATE-00"],
            "likelyUnits": [
                "mira-api/prisma/schema.prisma",
                "mira-api/src/partners-portal",
                "partners-portal/web",
                "mira-api/src/admin",
            ],
            "reuseAr": "Partner وProduct وService وPartnerTokenGuard وassertProductOwner",
            "risksAr": ["ترحيل منتجات بلا متغيرات", "إبقاء trackEvent يقبل معرف العميل"],
            "effortAr": "4 إلى 8 أسابيع",
            "effortAssumptionsAr": "مهندسان يعرفان Prisma الحالي، بلا قرار دفع داخلي، وبلا بيانات إنتاج تُنسخ",
            "entryCriteriaAr": ["إعادة مراجعة GATE-00 أو إعفاء مكتوب من المالك", "DEC-0003 محدد"],
            "exitCriteriaAr": [
                "متغير واحد يطابق لونًا ومقاسًا وتوفرًا معًا",
                "شريك لا يعدّل منتج شريك آخر على قاعدة اختبار",
                "المنتجات الحالية ما زالت تُقرأ",
                "حزمة اختبار العزل مرفقة",
            ],
            "proofPackAr": ["اختبارات الخدمة", "مخطط بعد الترحيل", "لقطات نموذج الشريك"],
            "rollbackAr": "علم ترحيل معطل واستعادة نسخة قاعدة الاختبار. لا إسقاط جداول الإنتاج ضمن هذه البوابة.",
        },
        {
            "id": "GATE-02",
            "titleAr": "دورة الوسائط والتصفح المرئي",
            "status": "planned",
            "goalAr": "رفع ومعالجة ومراجعة وتشغيل مقطع مرتبط بالمنتج الأصلي",
            "scopeAr": "تطبيق ميرا والخادم والتخزين. يشمل الفشل وإعادة المحاولة وليس شاشة تشغيل فقط.",
            "reqIds": ["REQ-0004", "REQ-0005", "REQ-0009", "REQ-0012"],
            "decisionIds": [],
            "dependsOn": ["GATE-01"],
            "likelyUnits": ["lib/features/marketplace", "mira-api/src", "موفر تخزين لم يُختار"],
            "reuseAr": "لا مشغل فيديو قائم داخل lib حسب EVD-0024. يُعاد استخدام هوية المنتج من GATE-01.",
            "risksAr": ["تقدير تكلفة غير متحقق", "ذاكرة الجهاز عند التحميل المسبق"],
            "effortAr": "6 إلى 10 أسابيع",
            "effortAssumptionsAr": "موفر تخزين متفق عليه، فيديو قصير حتى 60 ثانية، بلا بث حي",
            "entryCriteriaAr": ["GATE-01 خرج بأدلة", "حد حجم الوسائط مقرر"],
            "exitCriteriaAr": [
                "المقطع غير المنشور لا يظهر في الخلاصة",
                "صوت مقطع واحد فقط",
                "الموضع يُستأنف",
                "فشل الرفع قابل لإعادة المحاولة دون تكرار النشر",
            ],
            "proofPackAr": ["اختبار الدورة", "لقطات هاتف وجهاز لوحي", "سجل فشل المعالجة"],
            "rollbackAr": "إيقاف النشر بعلم وإبقاء الملفات غير المنشورة غير مرئية",
        },
        {
            "id": "GATE-03",
            "titleAr": "الفلاتر والفهرسة",
            "status": "planned",
            "goalAr": "فلاتر سريعة ومتقدمة على خصائص المتغير مع عدّ صحيح",
            "scopeAr": "الخادم والفهرس والتطبيق. ليس ترشيح قائمة محلية بعد جلب الكل.",
            "reqIds": ["REQ-0013", "REQ-0014"],
            "decisionIds": [],
            "dependsOn": ["GATE-01"],
            "likelyUnits": ["mira-api/src/marketplace", "lib/features/marketplace"],
            "reuseAr": "concernTags وskinTypes كسمات قائمة لا كبديل عن لون الملابس",
            "risksAr": ["عدّ المنتجات بدل عدّ المقاطع", "حالة الفلتر تضيع عند الرجوع"],
            "effortAr": "3 إلى 5 أسابيع",
            "effortAssumptionsAr": "الفهرس على قاعدة الاختبار، كتالوج حتى 50 منتجًا لكل متجر في سيناريو القبول",
            "entryCriteriaAr": ["متغيرات GATE-01 قابلة للاستعلام"],
            "exitCriteriaAr": [
                "مثال الفستان الأزرق M المتوفر يطابق متغيرًا واحدًا",
                "عدد المنتجات المطابقة مستقل عن عدد المقاطع",
                "الصفحة الثانية لا تكرر الصف الأول",
                "العودة من التفاصيل تُبقي الفلتر",
            ],
            "proofPackAr": ["استعلام موثّق", "لقطة العدد", "حالة فارغة"],
            "rollbackAr": "إخفاء الفلاتر المتقدمة والإبقاء على قائمة غير مفلترة",
        },
        {
            "id": "GATE-04",
            "titleAr": "المشاهير والإسناد والموافقة",
            "status": "planned",
            "goalAr": "إعلان يشير إلى المنتج بلا نسخ سعر أو مخزون",
            "scopeAr": "العقود والمراجعة الإدارية والعرض والخصوصية. ليس حملة إعلانية جاهزة.",
            "reqIds": ["REQ-0007", "REQ-0008", "REQ-0010", "REQ-0017"],
            "decisionIds": ["DEC-0004"],
            "dependsOn": ["GATE-01", "DEC-0004"],
            "likelyUnits": ["mira-api/src", "admin-portal/web", "lib/features/marketplace"],
            "reuseAr": "اعتماد الشريك الحالي كنمط مراجعة، لا نموذج مشهور قائم",
            "risksAr": ["اقتباس تنظيمي ليس اعتمادًا قانونيًا", "خلط الإعلان مع تحليل البشرة"],
            "effortAr": "4 إلى 7 أسابيع",
            "effortAssumptionsAr": "قرار DEC-0004 ثابت، وبلا بث حي",
            "entryCriteriaAr": ["GATE-01", "إجابة DEC-0004"],
            "exitCriteriaAr": [
                "تغيير سعر المنتج يظهر في الإعلان دون حقل سعر منسوخ",
                "رفض المتجر يزيل الإعلان ويبقي المنتج",
                "الإعلان موسوم مدفوعًا",
                "أطراف الناشر والمعلن والبائع مفصولة في السجل",
            ],
            "proofPackAr": ["عقد الإعلان", "اختبار الموافقة", "لقطة الوسم"],
            "rollbackAr": "حالة الربط suspended تخفي الإعلان فقط",
        },
        {
            "id": "GATE-05",
            "titleAr": "مسارات الطلب والحجز والاستفسار والتحليلات",
            "status": "planned",
            "goalAr": "تمييز الأفعال وحفظ لقطة المتغير عند الطلب إن اختير الدفع داخل ميرا",
            "scopeAr": "الخادم والتطبيق والإدارة والتحقق. الشراء الداخلي مشروط بـ DEC-0001.",
            "reqIds": ["REQ-0011", "REQ-0015", "REQ-0019"],
            "decisionIds": ["DEC-0001"],
            "dependsOn": ["GATE-01", "DEC-0001"],
            "likelyUnits": ["mira-api/src", "lib/features/marketplace", "admin-portal/web"],
            "reuseAr": "externalUrl للشراء الخارجي، وأحداث PartnerEvent بعد تصحيح مصدر partnerId",
            "risksAr": ["بناء طلب داخلي قبل قرار مكان الدفع", "التتبع الحالي يقبل معرف العميل"],
            "effortAr": "5 إلى 9 أسابيع إذا اختير دفع داخلي؛ 2 إلى 4 إذا بقي الشراء خارجيًا والحجز هو المسار الجديد",
            "effortAssumptionsAr": "لا تشغيل دفع إنتاجي داخل البوابة. بيئة اختبار فقط.",
            "entryCriteriaAr": ["قرار DEC-0001 مكتوب", "GATE-01 مكتمل"],
            "exitCriteriaAr": [
                "أزرار الشراء والحجز والاستفسار والاتصال منفصلة",
                "إن وُجد طلب فهو يحتفظ بلقطة السعر",
                "حدث التحليلات لا يُقبل بمعرف شريك من الجسم دون تفويض",
                "لا رسالة أو حجز حقيقي على إنتاج",
            ],
            "proofPackAr": ["مصفوفة المسارات", "اختبار اللقطة", "اختبار رفض التتبع المتجاوز"],
            "rollbackAr": "الإبقاء على الرابط الخارجي وإخفاء أزرار المسار الجديد",
        },
    ]
    dump("roadmap.json", roadmap)

    scope_decisions = [
        {
            "reqId": "REQ-0020",
            "kind": "scope-decision",
            "decisionId": "DEC-0002",
            "reasonAr": "البث الحي قرار نطاق مستقل. لا يوزَّع كمرحلة تنفيذ ولا يُترك خارج الخطة.",
        }
    ]
    dump("scope-decisions.json", scope_decisions)

    judgments = [
        {
            "id": "JDG-0001",
            "subject": "CAP-0007",
            "beforeAr": "موجودة ومفعلة ودليلها SPEC",
            "afterAr": "موجودة في المصدر، التفعيل الإنتاجي UNKNOWN، والأدلة تنفيذية",
            "reasonAr": "REV-0001: المواصفات ليست تنفيذًا",
            "evidenceIds": ["EVD-0007", "EVD-0011", "EVD-0012"],
        },
        {
            "id": "JDG-0002",
            "subject": "CAP-0008",
            "beforeAr": "موجودة ومفعلة بلا دليل",
            "afterAr": "موجودة في المصدر، التفعيل UNKNOWN، مع أدلة المتحكم والعميل",
            "reasonAr": "REV-0001 وREV-0002",
            "evidenceIds": ["EVD-0014", "EVD-0015"],
        },
        {
            "id": "JDG-0003",
            "subject": "CAP-0010 CAP-0011 CAP-0012 CAP-0014",
            "beforeAr": "غياب أو وجود بلا أدلة مرتبطة أو بمقتطف مخطط فقط",
            "afterAr": "غياب داخل نطاق بحث موثّق، أو وجود علم اشتراك في المصدر",
            "reasonAr": "REV-0002",
            "evidenceIds": ["EVD-0018", "EVD-0019", "EVD-0020", "EVD-0023"],
        },
        {
            "id": "JDG-0004",
            "subject": "CAP-0001 CAP-0002 CAP-0003 CAP-0009",
            "beforeAr": "التفعيل ENABLED مع SOURCE_ONLY",
            "afterAr": "التفعيل UNKNOWN لأن الشيفرة لا تثبت الإنتاج",
            "reasonAr": "قاعدة RC2: لا ENABLED بلا دليل تشغيل",
            "evidenceIds": ["EVD-0001", "EVD-0006", "EVD-0008"],
        },
        {
            "id": "JDG-0005",
            "subject": "PAUSE-0001",
            "beforeAr": "الإيقاف موثق بعبارة الانطلاق قريبًا وAPI قابل للوصول",
            "afterAr": "إخفاء واجهة موثق. وصول API وبوابة الخادم UNKNOWN. السبب التاريخي غير موثق.",
            "reasonAr": "REV-0003",
            "evidenceIds": ["EVD-0001", "EVD-0002", "EVD-0006"],
        },
        {
            "id": "JDG-0006",
            "subject": "PAUSE-0002",
            "beforeAr": "حجز متوقف",
            "afterAr": "مسار غير مكتمل وليس خدمة تُستأنف",
            "reasonAr": "REV-0003",
            "evidenceIds": ["EVD-0003", "EVD-0018"],
        },
        {
            "id": "JDG-0007",
            "subject": "PAUSE-0003",
            "beforeAr": "شراء داخلي متوقف",
            "afterAr": "غير منفذ حسب التصميم الحالي",
            "reasonAr": "REV-0003",
            "evidenceIds": ["EVD-0004", "EVD-0007", "EVD-0018"],
        },
    ]
    dump("judgment-corrections.json", judgments)

    print("data core written", "head_ok", head)


if __name__ == "__main__":
    main()
